import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyPage } from './audit-page.mjs';

const cases = [
    ['a successful response serving an access-denied page', '<title>Access Denied</title>', 'SOFT_BLOCK'],
    ['a missing-product page', '<title>404 Not Found | Retailer</title>', 'NOT_FOUND'],
    ['a category landing page', '<title>Shop Blazers</title>', 'UNVERIFIED'],
    ['a browser navigation error', '<title>Retailer</title><div id="main-frame-error">', 'ERROR'],
    [
        'a product candidate with unrelated error text in a script',
        '<title>Wool Blazer</title><script type="application/ld+json">{"@type":"Product"}</script><script>const message = "access denied";</script>',
        'PRODUCT_CANDIDATE',
    ],
];

for (const [name, html, expected] of cases) {
    test(name, () => assert.equal(classifyPage(html), expected));
}
