#!/usr/bin/env node
/**
 * One-off catalog migration for Sprint 3.
 *
 * Adds `department` to every existing product and outfit (all Sprint 1/2 catalog
 * rows are womenswear), then appends menswear products and outfits so both
 * departments have coverage across every occasion and budget band.
 *
 * Deliberately a script rather than a hand-edit: 26 products and 21 outfits would
 * mean 47 manual insertions, and one missed row would leave `department: undefined`
 * at runtime. Running it twice is a no-op because it is keyed on id.
 *
 * Deleted after use — it is a migration, not application code.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, '../src/data/catalog.json');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

// ── 1. Tag every existing row as womenswear ────────────────────────────────────
for (const product of catalog.products) {
    product.department ??= 'Womenswear';
}
for (const outfit of catalog.outfits) {
    outfit.department ??= 'Womenswear';
}

// ── 2. Menswear products ───────────────────────────────────────────────────────
// Prices are curated sample data captured 2026-11-18, matching the existing rows.
// Retailers are limited to ones already in the catalog so the retailer filter stays
// meaningful and the RETAILERS vocabulary does not grow arbitrarily.
const menswearProducts = [
    // ---- tops ----
    {
        id: 'm-tee-heavy',
        name: 'Heavyweight Cotton Tee',
        retailer: 'Uniqlo',
        slot: 'top',
        department: 'Menswear',
        price: 24.9,
        productUrl: 'https://www.uniqlo.com/us/en/men/t-shirts',
        priceRetrievedAt: '2026-11-18',
        colors: ['White', 'Black'],
        styles: ['Minimalist', 'Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
        notes: 'Menswear baseline tee, mirrors p-tee-cotton in weight class.',
    },
    {
        id: 'm-oxford',
        name: 'Cotton Oxford Shirt',
        retailer: 'Banana Republic',
        slot: 'top',
        department: 'Menswear',
        price: 68,
        productUrl: 'https://bananarepublic.gap.com/browse/division.do?cid=5155',
        priceRetrievedAt: '2026-11-18',
        colors: ['White', 'Navy'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-linen-shirt',
        name: 'Linen Camp Shirt',
        retailer: 'Zara',
        slot: 'top',
        department: 'Menswear',
        price: 45.9,
        productUrl: 'https://www.zara.com/us/en/man-shirts-l737.html',
        priceRetrievedAt: '2026-11-18',
        colors: ['Beige', 'Earth Tones'],
        styles: ['Bohemian', 'Trendy'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-merino-crew',
        name: 'Merino Crewneck Sweater',
        retailer: 'Uniqlo',
        slot: 'top',
        department: 'Menswear',
        price: 49.9,
        productUrl: 'https://www.uniqlo.com/us/en/men/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Navy', 'Black', 'Beige'],
        styles: ['Minimalist', 'Classic'],
        image: null,
        arSupported: true,
        overlayAsset: '/ar/merino-crew.svg',
        notes: 'AR garment 6 of 7. Menswear knit for the auto-tracking demo.',
    },
    {
        id: 'm-black-tee',
        name: 'Boxy Boxy Tee',
        retailer: 'Zara',
        slot: 'top',
        department: 'Menswear',
        price: 25.9,
        productUrl: 'https://www.zara.com/us/en/man-tshirts-l855.html',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black'],
        styles: ['Streetwear', 'Trendy'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },

    // ---- layers ----
    {
        id: 'm-unstructured-blazer',
        name: 'Unstructured Cotton Blazer',
        retailer: 'Massimo Dutti',
        slot: 'layer',
        department: 'Menswear',
        price: 179,
        productUrl: 'https://www.massimodutti.com/us/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Navy', 'Beige'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: true,
        overlayAsset: '/ar/unstructured-blazer.svg',
        notes: 'AR garment 7 of 7. Menswear tailoring for the AR demo.',
    },
    {
        id: 'm-tux-jacket',
        name: 'Satin-Lapel Dinner Jacket',
        retailer: 'Zara',
        slot: 'layer',
        department: 'Menswear',
        price: 199,
        productUrl: 'https://www.zara.com/us/en/man-blazers-l1055.html',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black'],
        styles: ['Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
        notes: 'Carries the menswear black-tie outfit under $500.',
    },
    {
        id: 'm-bomber',
        name: 'Lightweight Bomber Jacket',
        retailer: 'Zara',
        slot: 'layer',
        department: 'Menswear',
        price: 89.9,
        productUrl: 'https://www.zara.com/us/en/man-blazers-l1055.html',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black', 'Navy'],
        styles: ['Streetwear', 'Trendy'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },

    // ---- bottoms ----
    {
        id: 'm-chino',
        name: 'Slim Cotton Chino',
        retailer: 'Banana Republic',
        slot: 'bottom',
        department: 'Menswear',
        price: 89,
        productUrl: 'https://bananarepublic.gap.com/browse/division.do?cid=5155',
        priceRetrievedAt: '2026-11-18',
        colors: ['Beige', 'Navy'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-wool-trouser',
        name: 'Wool-Blend Suit Trouser',
        retailer: 'Massimo Dutti',
        slot: 'bottom',
        department: 'Menswear',
        price: 129,
        productUrl: 'https://www.massimodutti.com/us/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Navy', 'Black'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-cargo',
        name: 'Relaxed Cargo Trouser',
        retailer: 'Dickies',
        slot: 'bottom',
        department: 'Menswear',
        price: 69,
        productUrl: 'https://www.dickies.com/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Earth Tones', 'Black'],
        styles: ['Streetwear'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-denim',
        name: 'Straight-Leg Denim',
        retailer: "Levi's",
        slot: 'bottom',
        department: 'Menswear',
        price: 98,
        productUrl: 'https://www.levi.com/US/en_US/clothing/men',
        priceRetrievedAt: '2026-11-18',
        colors: ['Navy', 'Black'],
        styles: ['Classic', 'Streetwear'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },

    // ---- shoes ----
    {
        id: 'm-derby',
        name: 'Leather Derby Shoe',
        retailer: 'G.H. Bass',
        slot: 'shoes',
        department: 'Menswear',
        price: 135,
        productUrl: 'https://www.ghbass.com/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black', 'Earth Tones'],
        styles: ['Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-loafer-suede',
        name: 'Suede Penny Loafer',
        retailer: 'G.H. Bass',
        slot: 'shoes',
        department: 'Menswear',
        price: 120,
        productUrl: 'https://www.ghbass.com/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Earth Tones', 'Beige'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-low-sneaker',
        name: 'Leather Court Sneaker',
        retailer: 'Vans',
        slot: 'shoes',
        department: 'Menswear',
        price: 75,
        productUrl: 'https://www.vans.com/en-us/shoes-c00081',
        priceRetrievedAt: '2026-11-18',
        colors: ['White', 'Black'],
        styles: ['Streetwear', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-chelsea',
        name: 'Chelsea Boot',
        retailer: 'Zara',
        slot: 'shoes',
        department: 'Menswear',
        price: 99.9,
        productUrl: 'https://www.zara.com/us/en/man-shoes-l769.html',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black', 'Earth Tones'],
        styles: ['Classic', 'Trendy'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },

    // ---- accessories ----
    {
        id: 'm-belt',
        name: 'Full-Grain Leather Belt',
        retailer: 'Massimo Dutti',
        slot: 'accessory',
        department: 'Menswear',
        price: 59,
        productUrl: 'https://www.massimodutti.com/us/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black', 'Earth Tones'],
        styles: ['Classic', 'Minimalist'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-watch',
        name: 'Minimal Field Watch',
        retailer: 'Nordstrom',
        slot: 'accessory',
        department: 'Menswear',
        price: 145,
        productUrl: 'https://www.nordstrom.com/browse/men/accessories/watches',
        priceRetrievedAt: '2026-11-18',
        colors: ['Black', 'Beige'],
        styles: ['Minimalist', 'Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-scarf',
        name: 'Wool Muffler',
        retailer: 'Uniqlo',
        slot: 'accessory',
        department: 'Menswear',
        price: 29.9,
        productUrl: 'https://www.uniqlo.com/us/en/men/',
        priceRetrievedAt: '2026-11-18',
        colors: ['Earth Tones', 'Navy'],
        styles: ['Minimalist', 'Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
    {
        id: 'm-pocket-square',
        name: 'Silk Pocket Square',
        retailer: 'Nordstrom',
        slot: 'accessory',
        department: 'Menswear',
        price: 35,
        productUrl: 'https://www.nordstrom.com/browse/men/accessories',
        priceRetrievedAt: '2026-11-18',
        colors: ['Colorful', 'Navy'],
        styles: ['Classic'],
        image: null,
        arSupported: false,
        overlayAsset: null,
    },
];

// ── 3. Menswear outfits ────────────────────────────────────────────────────────
// Coverage goal: every Occasion x DressCode pair reachable in menswear, with a
// budget spread from ~$90 to ~$480, mirroring the womenswear ladder.
const menswearOutfits = [
    {
        id: 'om-01',
        name: 'Everyday Standard',
        tagline: 'A good tee, a clean chino, nothing else needed.',
        department: 'Menswear',
        occasions: ['Casual Outing'],
        dressCodes: ['Casual', 'Smart Casual'],
        styles: ['Minimalist', 'Classic'],
        colors: ['White', 'Beige', 'Black'],
        itemIds: ['m-tee-heavy', 'm-chino', 'm-low-sneaker'],
        heroImage: null,
    },
    {
        id: 'om-02',
        name: 'Denim Sunday',
        tagline: 'Washed denim and a heavy tee, kept easy.',
        department: 'Menswear',
        occasions: ['Casual Outing'],
        dressCodes: ['Casual'],
        styles: ['Streetwear', 'Classic'],
        colors: ['Navy', 'White'],
        itemIds: ['m-tee-heavy', 'm-denim', 'm-low-sneaker'],
        heroImage: null,
    },
    {
        id: 'om-03',
        name: 'Utility Layers',
        tagline: 'Cargo volume under a bomber.',
        department: 'Menswear',
        occasions: ['Casual Outing', 'Party'],
        dressCodes: ['Casual', 'Smart Casual'],
        styles: ['Streetwear', 'Trendy'],
        colors: ['Earth Tones', 'Black'],
        itemIds: ['m-black-tee', 'm-bomber', 'm-cargo', 'm-low-sneaker'],
        heroImage: null,
    },
    {
        id: 'om-04',
        name: 'Linen Ease',
        tagline: 'Camp collar, chino, bare ankle.',
        department: 'Menswear',
        occasions: ['Casual Outing', 'Party'],
        dressCodes: ['Casual', 'Smart Casual'],
        styles: ['Bohemian', 'Trendy'],
        colors: ['Beige', 'Earth Tones'],
        itemIds: ['m-linen-shirt', 'm-chino', 'm-loafers', 'm-scarf'],
        heroImage: null,
    },
    {
        id: 'om-05',
        name: 'Bomber Uniform',
        tagline: 'Black on black with an edge.',
        department: 'Menswear',
        occasions: ['Party'],
        dressCodes: ['Smart Casual'],
        styles: ['Streetwear', 'Trendy'],
        colors: ['Black'],
        itemIds: ['m-black-tee', 'm-bomber', 'm-wool-trouser', 'm-chelsea'],
        heroImage: null,
    },
    {
        id: 'om-06',
        name: 'Dinner Black',
        tagline: 'Satin lapel, wool trouser, polished boot.',
        department: 'Menswear',
        occasions: ['Party'],
        dressCodes: ['Cocktail', 'Smart Casual'],
        styles: ['Classic', 'Trendy'],
        colors: ['Black'],
        itemIds: ['m-oxford', 'm-tux-jacket', 'm-wool-trouser', 'm-chelsea'],
        heroImage: null,
    },
    {
        id: 'om-07',
        name: 'Office Core',
        tagline: 'Oxford, blazer, grey trouser.',
        department: 'Menswear',
        occasions: ['Work'],
        dressCodes: ['Business Formal', 'Smart Casual'],
        styles: ['Classic', 'Minimalist'],
        colors: ['Navy', 'Black', 'White'],
        itemIds: ['m-oxford', 'm-unstructured-blazer', 'm-wool-trouser', 'm-derby'],
        heroImage: null,
    },
    {
        id: 'om-08',
        name: 'Soft Business',
        tagline: 'Merino and chino, formally understated.',
        department: 'Menswear',
        occasions: ['Work'],
        dressCodes: ['Smart Casual', 'Business Formal'],
        styles: ['Minimalist', 'Classic'],
        colors: ['Navy', 'Beige'],
        itemIds: ['m-merino-crew', 'm-chino', 'm-derby'],
        heroImage: null,
    },
    {
        id: 'om-09',
        name: 'Loafer Days',
        tagline: 'The most comfortable way to look hired.',
        department: 'Menswear',
        occasions: ['Work'],
        dressCodes: ['Smart Casual', 'Casual'],
        styles: ['Classic', 'Minimalist'],
        colors: ['Beige', 'Earth Tones'],
        itemIds: ['m-oxford', 'm-chino', 'm-loafer-suede', 'm-belt'],
        heroImage: null,
    },
    {
        id: 'om-10',
        name: 'Merino & Wool',
        tagline: 'Knit over tailoring, no tie.',
        department: 'Menswear',
        occasions: ['Work'],
        dressCodes: ['Business Formal'],
        styles: ['Minimalist', 'Classic'],
        colors: ['Black', 'Navy'],
        itemIds: ['m-merino-crew', 'm-wool-trouser', 'm-derby', 'm-watch'],
        heroImage: null,
    },
    {
        id: 'om-11',
        name: 'Black Tie, Relaxed',
        tagline: 'Dinner jacket with an open collar.',
        department: 'Menswear',
        occasions: ['Wedding'],
        dressCodes: ['Black Tie'],
        styles: ['Classic', 'Minimalist'],
        colors: ['Black'],
        itemIds: ['m-oxford', 'm-tux-jacket', 'm-wool-trouser', 'm-derby', 'm-pocket-square'],
        heroImage: null,
    },
    {
        id: 'om-12',
        name: 'Wedding Guest Classic',
        tagline: 'Unstructured tailoring for a long ceremony.',
        department: 'Menswear',
        occasions: ['Wedding'],
        dressCodes: ['Cocktail', 'Smart Casual', 'Business Formal'],
        styles: ['Classic', 'Minimalist'],
        colors: ['Navy', 'Beige'],
        itemIds: ['m-oxford', 'm-unstructured-blazer', 'm-chino', 'm-loafer-suede'],
        heroImage: null,
    },
    {
        id: 'om-13',
        name: 'Garden Party Linen',
        tagline: 'Linen, earth tones, a silk pocket square.',
        department: 'Menswear',
        occasions: ['Wedding'],
        dressCodes: ['Cocktail', 'Smart Casual', 'Casual'],
        styles: ['Bohemian', 'Classic'],
        colors: ['Beige', 'Earth Tones', 'Colorful'],
        itemIds: ['m-linen-shirt', 'm-chino', 'm-loafer-suede', 'm-pocket-square'],
        heroImage: null,
    },
    {
        id: 'om-14',
        name: 'Bomber Wedding',
        tagline: 'For the friend who never wears a suit.',
        department: 'Menswear',
        occasions: ['Wedding'],
        dressCodes: ['Smart Casual', 'Casual'],
        styles: ['Streetwear', 'Trendy'],
        colors: ['Black', 'Earth Tones'],
        itemIds: ['m-black-tee', 'm-bomber', 'm-wool-trouser', 'm-chelsea'],
        heroImage: null,
    },
];

// ── 4. Merge, keyed on id so re-running is a no-op ─────────────────────────────
const productIds = new Set(catalog.products.map((p) => p.id));
for (const product of menswearProducts) {
    if (!productIds.has(product.id)) catalog.products.push(product);
}

const outfitIds = new Set(catalog.outfits.map((o) => o.id));
for (const outfit of menswearOutfits) {
    if (!outfitIds.has(outfit.id)) catalog.outfits.push(outfit);
}

catalog.version = '1.1.0-sprint3';

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 4)}\n`, 'utf8');

const womens = catalog.products.filter((p) => p.department === 'Womenswear').length;
const mens = catalog.products.filter((p) => p.department === 'Menswear').length;
console.log(
    `catalog ${catalog.version}: ${catalog.products.length} products (${womens} womenswear, ${mens} menswear), ` +
    `${catalog.outfits.length} outfits ` +
    `(${catalog.outfits.filter((o) => o.department === 'Menswear').length} menswear)`,
);
