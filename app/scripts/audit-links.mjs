#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyPage } from './audit-page.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/data/catalog.json');

const TIMEOUT_MS = 20_000;
const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CONCURRENCY = 1;
const status = { ok: [], inconclusive: [], broken: [], noUrl: [] };

function classify(code) {
    if (code === 404 || code === 410 || code === 'NOT_FOUND') return 'broken';
    if (code === 'PRODUCT_CANDIDATE') return 'ok';
    return 'inconclusive';
}

async function probeOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': BROWSER_UA,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
            },
        });
        if (!response.ok) {
            await response.body?.cancel();
            return response.status;
        }

        // Bound both the bytes read and the time spent waiting for the body.
        const reader = response.body?.getReader();
        if (!reader) return 'ERROR';
        const decoder = new TextDecoder();
        let body = '';
        let bytes = 0;
        try {
            while (bytes < 128_000) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = value.subarray(0, 128_000 - bytes);
                bytes += chunk.byteLength;
                body += decoder.decode(chunk, { stream: true });
            }
            return classifyPage(body + decoder.decode());
        } finally {
            void reader.cancel().catch(() => {});
        }
    } catch (error) {
        return error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
    } finally {
        clearTimeout(timer);
    }
}

async function probe(url) {
    const first = await probeOnce(url);
    if (first !== 'TIMEOUT' && first !== 'ERROR' && first !== 429) return first;

    await new Promise((resolve) => setTimeout(resolve, 1500));
    return probeOnce(url);
}

async function main() {
    const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
    const products = raw.products ?? [];

    console.log(`VibeFit link audit — catalog ${raw.version}, ${products.length} products\n`);

    const queue = [...products];

    async function worker() {
        while (queue.length > 0) {
            const product = queue.shift();
            if (!product) break;

            if (!product.productUrl) {
                status.noUrl.push(product);
                console.log(`  —  ${product.id.padEnd(20)} no URL (correct for this edge case)`);
                continue;
            }

            const code = await probe(product.productUrl);
            const bucket = classify(code);
            status[bucket].push(product);
            console.log(`  ${String(code).padEnd(4)} ${product.id.padEnd(20)} ${product.retailer}`);
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const withUrl = products.length - status.noUrl.length;
    const percent = withUrl === 0 ? 0 : Math.round((status.ok.length / withUrl) * 100);

    console.log('\n─── Summary ───');
    console.log(`  with a URL        ${withUrl}`);
    console.log(`  product candidates ${status.ok.length}`);
    console.log(`  inconclusive      ${status.inconclusive.length}  (verify by hand)`);
    console.log(`  broken            ${status.broken.length}`);
    console.log(`  no URL            ${status.noUrl.length}  (expected edge cases)`);
    console.log(`\n  product-candidate rate: ${percent}% of ${withUrl} links`);

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
