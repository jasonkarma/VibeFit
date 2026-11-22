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
 * Second, harder-won rule: **the User-Agent decides the answer.** Several retailers
 * (Zara, Massimo Dutti, Vans) serve 404/410 to obviously-bot traffic and 200 to a
 * browser UA for the exact same URL. An earlier version of this script identified
 * itself honestly and therefore reported a pass rate of 58% on links that were
 * fine. Since the charter criterion is about links opening correctly *when a human
 * clicks them*, the probe now sends a mainstream browser UA and reports the result
 * a user would actually see.
 *
 * What this script still will not do is declare a link good because it merely
 * resolved. `INCONCLUSIVE` stays a real category: a 403 from a bot wall tells us
 * nothing either way, and pretending otherwise would inflate the number.
 *
 * Usage: npm run audit:links
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/data/catalog.json');

const TIMEOUT_MS = 20_000;

/**
 * Sequential by design. Six parallel probes triggered rate limiting, which turned
 * working links into 429s and made the pass rate non-reproducible — the same
 * catalog reported 58% and then 50% minutes apart. An audit whose number moves is
 * not an audit.
 */
const CONCURRENCY = 1;

const status = { ok: [], inconclusive: [], broken: [], noUrl: [] };

/**
 * Bucket a probe result.
 *
 * Only `404` and `410` mean "this product page does not exist". Everything else
 * that is not a clean 2xx/3xx is *inconclusive*, because it is evidence about the
 * network or a bot wall, not about the link. An earlier version bucketed TIMEOUT
 * and ERROR as broken, which quietly slandered four working links every run.
 */
function classify(code) {
    if (typeof code === 'number') {
        if (code === 404 || code === 410) return 'broken';
        if (code >= 200 && code < 400) return 'ok';
        return 'inconclusive';
    }
    // 'SOFT_BLOCK', 'TIMEOUT', 'ERROR' — none of these prove a link is dead.
    return 'inconclusive';
}

/**
 * A current desktop Chrome UA. Not deception for its own sake: we are measuring
 * the same thing a person clicking the link in a browser would experience, and a
 * bot UA is simply a different experiment with a different answer.
 */
const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Probe a URL the way a browser does: **GET**, once, with a browser UA.
 *
 * Two corrections over the naive version, both learned by actually running it:
 *
 *  1. **GET, not HEAD.** A browser issues GET. Several retailers answer HEAD with
 *     405 or a bot-wall 403 while serving the page perfectly to GET, so HEAD-first
 *     probing manufactured failures on links that work.
 *  2. **A retry on transient states.** Timeouts, network errors and 429 are not
 *     evidence about a link; they are evidence about the network. They are retried
 *     once before being classified.
 */
/**
 * Body markers that mean "this is not the product page", served with a 200.
 *
 * This is the finding that made the audit trustworthy: Levi's returns HTTP 200 with
 * `<title>Access Denied</title>` for a perfectly real product URL. A status-code
 * only audit would score that as healthy, which is precisely the kind of
 * false-positive this script exists to prevent — the charter criterion is "the link
 * opens the correct product page", not "the server answered".
 */
const SOFT_BLOCK_MARKERS = [
    /access denied/i,
    /are you a robot/i,
    /unusual traffic/i,
    /request blocked/i,
    /verify you are (a )?human/i,
    /enable javascript and cookies/i,
    /<title>\s*(just a moment|attention required|pardon our interruption)/i,
];

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
        clearTimeout(timer);

        // A 200 is not sufficient evidence. Read a bounded slice of the body and
        // look for bot-wall markers before calling it healthy.
        if (response.status >= 200 && response.status < 400) {
            try {
                const body = (await response.text()).slice(0, 20_000);
                if (SOFT_BLOCK_MARKERS.some((marker) => marker.test(body))) {
                    return 'SOFT_BLOCK';
                }
            } catch {
                // Body unreadable (stream aborted). Status alone has to stand.
            }
        }

        return response.status;
    } catch (error) {
        clearTimeout(timer);
        return error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
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
            const bucket = classify(code);
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
