#!/usr/bin/env node
/**
 * Product link checker.
 *
 * The Project Charter makes link validity a success criterion ("at least 90% of
 * product links open the correct product page when tested"), so this is a
 * first-class check rather than an afterthought.
 *
 * Important interpretation rule: a retailer returning 403 or 429 to an automated
 * request proves nothing about whether the link works in a browser. Those are
 * reported as INCONCLUSIVE and must be confirmed by hand. Only 404/410 count as
 * genuinely broken.
 *
 * Usage: npm run audit:links
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/data/catalog.json');

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;

const status = { ok: [], inconclusive: [], broken: [], noUrl: [] };

function classify(code) {
    if (code >= 200 && code < 400) return 'ok';
    if (code === 403 || code === 429 || code === 405 || code === 999) return 'inconclusive';
    if (code >= 400) return 'broken';
    return 'inconclusive';
}

async function probe(url) {
    for (const method of ['HEAD', 'GET']) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method,
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    // Identifies the checker honestly rather than pretending to be a browser.
                    'User-Agent': 'VibeFit-LinkAudit/1.0 (academic project)',
                    Accept: 'text/html,application/xhtml+xml',
                },
            });
            clearTimeout(timer);
            if (method === 'HEAD' && (response.status === 405 || response.status === 403)) {
                continue; // Some hosts reject HEAD but answer GET.
            }
            return response.status;
        } catch (error) {
            clearTimeout(timer);
            if (method === 'GET') return error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
        }
    }
    return 'ERROR';
}

async function main() {
    const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
    const products = raw.products ?? [];

    console.log(`VibeFit link audit — catalog ${raw.version}, ${products.length} products\n`);

    const queue = [...products];
    const results = [];

    async function worker() {
        while (queue.length > 0) {
            const product = queue.shift();
            if (!product) break;

            if (!product.productUrl) {
                status.noUrl.push(product);
                results.push({ product, code: 'NO_URL' });
                console.log(`  —  ${product.id.padEnd(20)} no URL (correct for this edge case)`);
                continue;
            }

            const code = await probe(product.productUrl);
            const bucket = typeof code === 'number' ? classify(code) : 'broken';
            status[bucket].push(product);
            results.push({ product, code });
            console.log(`  ${String(code).padEnd(4)} ${product.id.padEnd(20)} ${product.retailer}`);
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const withUrl = products.length - status.noUrl.length;
    const percent = withUrl === 0 ? 0 : Math.round((status.ok.length / withUrl) * 100);

    console.log('\n─── Summary ───');
    console.log(`  with a URL        ${withUrl}`);
    console.log(`  reachable         ${status.ok.length}`);
    console.log(`  inconclusive      ${status.inconclusive.length}  (403/429/timeout — verify by hand)`);
    console.log(`  broken            ${status.broken.length}`);
    console.log(`  no URL            ${status.noUrl.length}  (expected edge cases)`);
    console.log(`\n  automated pass rate: ${percent}% of ${withUrl} links`);

    if (status.broken.length > 0) {
        console.log('\n  Broken links needing replacement:');
        for (const item of status.broken) {
            console.log(`    - ${item.id}: ${item.productUrl}`);
        }
    }

    if (status.inconclusive.length > 0) {
        console.log('\n  Must be confirmed manually before the 12/08 demo:');
        for (const item of status.inconclusive) {
            console.log(`    - ${item.id}: ${item.productUrl}`);
        }
    }

    console.log(
        '\n  Reminder: a null URL is a valid state, not a failure. Do not invent a link for it.',
    );

    // Exit non-zero only for genuinely broken links, so bot-blocking retailers do
    // not fail a CI run that cannot tell the difference.
    process.exit(status.broken.length > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
});
