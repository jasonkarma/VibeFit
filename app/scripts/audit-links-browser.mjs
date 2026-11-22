#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { classifyPage, pageTitle } from './audit-page.mjs';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/data/catalog.json');
const reportPath = resolve(here, '../../docs/product-link-audit.json');

const CHROME_BIN =
    process.env.CHROME_PATH ??
    (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : 'google-chrome');

const NAV_TIMEOUT_MS = 45_000;

let profileDir = null;
let profileIndex = 0;

/**
 * Render one URL in headless Chrome and return its DOM.
 *
 * A fresh throwaway profile per URL: retailer sites set a wall of cookies, and
 * reusing a profile let one site's bot wall leak into the next site's result.
 */
async function dumpDom(url) {
    profileIndex += 1;
    const dir = resolve(profileDir, `p${profileIndex}`);

    const { stdout } = await execFileAsync(
        CHROME_BIN,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--hide-scrollbars',
            '--window-size=1280,900',
            // A real UA: this is measuring the human experience.
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            // Give client-rendered storefronts time to paint.
            '--virtual-time-budget=8000',
            `--user-data-dir=${dir}`,
            '--dump-dom',
            url,
        ],
        { timeout: NAV_TIMEOUT_MS, maxBuffer: 24 * 1024 * 1024 },
    );

    return stdout ?? '';
}

async function auditOne(product) {
    try {
        const dom = await dumpDom(product.productUrl);
        const title = pageTitle(dom);
        return { id: product.id, retailer: product.retailer, url: product.productUrl, title, bucket: classifyPage(dom) };
    } catch (error) {
        const message = String(error?.stderr ?? error?.message ?? 'unknown');
        // Chrome exits non-zero on some sites even when the DOM is fine; recover the
        // DOM it did print before giving up.
        const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
        if (stdout.length > 500) {
            const title = pageTitle(stdout);
            return {
                id: product.id,
                retailer: product.retailer,
                url: product.productUrl,
                title,
                bucket: classifyPage(stdout),
            };
        }
        return {
            id: product.id,
            retailer: product.retailer,
            url: product.productUrl,
            title: '',
            bucket: 'ERROR',
            detail: message.slice(0, 200),
        };
    }
}

async function main() {
    const onlyId = process.argv[2];
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

    const products = (catalog.products ?? []).filter((product) =>
        onlyId ? product.id === onlyId : true,
    );

    profileDir = resolve(tmpdir(), `vibefit-audit-${Date.now()}`);
    await mkdir(profileDir, { recursive: true });

    console.log(`Browser link audit — catalog ${catalog.version}, ${products.length} products\n`);

    const results = [];
    for (const product of products) {
        if (!product.productUrl) {
            console.log(`  ${'NO_URL'.padEnd(11)} ${product.id.padEnd(18)} intentional edge case`);
            results.push({ id: product.id, retailer: product.retailer, bucket: 'NO_URL' });
            continue;
        }

        const outcome = await auditOne(product);
        console.log(
            `  ${outcome.bucket.padEnd(11)} ${product.id.padEnd(18)} ${String(outcome.retailer).padEnd(16)} ${(outcome.title || '').slice(0, 50)}`,
        );
        results.push(outcome);
    }

    if (onlyId) {
        console.log('\nSingle-product audit complete.');
        await rm(profileDir, { recursive: true, force: true }).catch(() => { });
        return;
    }

    const withUrl = results.filter((r) => r.bucket !== 'NO_URL');
    const ok = results.filter((r) => r.bucket === 'PRODUCT_CANDIDATE').length;
    const percent = withUrl.length === 0 ? 0 : Math.round((ok / withUrl.length) * 100);

    const byBucket = results.reduce((acc, r) => {
        acc[r.bucket] = (acc[r.bucket] ?? 0) + 1;
        return acc;
    }, {});

    console.log('\n─── Summary ───');
    console.log(`  with a URL     ${withUrl.length}`);
    console.log(`  candidates     ${ok}   (${percent}%)`);
    for (const [bucket, count] of Object.entries(byBucket)) {
        if (bucket === 'PRODUCT_CANDIDATE' || bucket === 'NO_URL') continue;
        console.log(`  ${bucket.padEnd(14)} ${count}`);
    }
    console.log(`\n  browser product-candidate rate: ${percent}% of ${withUrl.length} links`);

    const failing = results.filter((r) => r.bucket !== 'PRODUCT_CANDIDATE' && r.bucket !== 'NO_URL');
    if (failing.length > 0) {
        console.log('\n  Needs attention:');
        for (const item of failing) {
            console.log(`    ${item.bucket.padEnd(11)} ${item.id.padEnd(18)} ${item.url}`);
        }
    }

    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(
        reportPath,
        `${JSON.stringify(
            {
                auditedAt: new Date().toISOString(),
                catalogVersion: catalog.version,
                method: 'headless Chrome --dump-dom (real browser engine)',
                summary: { withUrl: withUrl.length, ok, percent, byBucket },
                results,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
    console.log('  report written to docs/product-link-audit.json');

    await rm(profileDir, { recursive: true, force: true }).catch(() => { });
}

await main();
