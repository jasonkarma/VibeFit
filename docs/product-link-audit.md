# Product link audit

The charter requires at least 90% of links to open the correct product page. Verify the retailer, item, and variant in a browser before counting a link toward that threshold.

## Catalog status

The historical [browser report](product-link-audit.json) for catalog `1.1.0-sprint3` recorded 26 reachable results out of 46 URLs, 12 soft blocks, two missing pages, and six navigation errors. Its reachable count included pages without product-level evidence, and the catalog has changed since that run. The current percentage of correct product pages is unverified.

## Verified outfits

Soft Business uses an Everlane cotton crewneck, Everlane slim chinos, and black
G.H. Bass Larson loafers. The verified sample total is $284. The try-on overlay
uses the official flat-lay image of the exact sweater.

Garden Formal and Bomber Wedding now also have verified retailer pages and
matching photos for every piece. The November 22 price snapshots total $222
and $385 respectively. These outfits use current retail selections in the same
style, including black loafers in Bomber Wedding. The bomber had limited
inventory. Both outfits have a camera overlay sourced from the exact top's
flat-lay photo.

On November 22, 2026, all three Neutral Layers retailer pages returned HTTP 200
and identified the items and colorways shown on the recommendation card. Each
page listed some inventory. The trousers had limited size availability. The
snapshot total was $295 before tax and shipping.

| Item | Colorway | Sample price |
| --- | --- | --- |
| [Everlane Cashmere Slim Crew Sweater](https://www.everlane.com/products/womens-cashmere-slim-crew-sweater-navy) | Navy | $68 |
| [Everlane Wide-Leg Pant in Stretch Linen](https://www.everlane.com/products/womens-wide-leg-pant-stretch-linen-trench-coat-khaki) | Trench Coat Khaki | $32 |
| [G.H. Bass Whitney Weejuns Penny Loafer](https://www.ghbass.com/products/women-whitney-weejuns-penny-loafer-black) | Black | $195 |

The app hosts copies of the retailer photos for this demo. The camera overlay
uses Everlane's front-facing gallery photo for the same navy sweater, clipped to
the garment on the try-on stage. The product pages provide the model and color
reference for the bundled images.

## Catalog 1.5.0-sprint3

All 57 catalog entries now point to retailer product pages and bundle a matching
retailer image. Retired, blocked, and category-only listings were replaced with
current products in the same garment categories where possible. These can differ
in brand, fabric, cut, and price from the original seed items. Two low-budget
demo scenarios use updated budget values to reflect the new listings.

The catalog uses price snapshots. A link verification records product identity
and does not measure future availability.

## Run the audit

From `app/`, run `npm run audit:links` for HTTP screening. Run `CHROME_PATH=/usr/bin/chromium node scripts/audit-links-browser.mjs` for a rendered audit on a Linux machine with Chromium. A product ID argument runs a single check without overwriting the full report.

- `PRODUCT_CANDIDATE` indicates product metadata. Check that the page actually shows the expected item and variant.
- `UNVERIFIED` includes generic storefronts, collection pages, and pages without recognizable product metadata.
- `SOFT_BLOCK` indicates a challenge or access-denied page. `ERROR` indicates an inconclusive navigation or response.
- `NOT_FOUND`, HTTP 404, and HTTP 410 require replacing the link with a verified product page or using the unavailable-link state.

Verify redirects, replacements, and blocked results in a browser with access to the retailer. Record verified matches separately from automated candidates.

For each verified replacement, source an approved photo of the same item and
colorway. Start with one complete recommended outfit so links and photos can be
checked together from the recommendation page.
