# Product Link Audit — VibeFit Catalog

The Project Charter success criterion states: **"At least 90% of product links open
the correct product page when tested."**

This document tracks that obligation for the Sprint 1 seed catalog
([`catalog.json`](../app/src/data/catalog.json), version `1.0.0-sprint1`, prices
retrieved `2026-11-18`).

> **Scope note.** Sprint 1 does not render shopping links — that is Story 8, scheduled
> for Sprint 2. This audit exists now because the charter makes link validity a
> *success criterion*, not a Sprint 2 task, and because discovering dead links in
> December is far more expensive than doing it once while writing the catalog.

---

## ⚠️ Measured status: NOT yet at the 90% charter bar

The audit was executed on **2026-11-18**. Real results:

| Bucket | Count | Meaning |
|---|---|---|
| Reachable (2xx/3xx) | **15 / 26** | Confirmed working |
| Inconclusive (403/429) | 5 / 26 | Bot-blocked; needs a human in a browser |
| Broken (404/410) | **6 / 26** | Must be replaced |
| No URL (by design) | 1 | `p-hoops` — correct edge case, not a failure |

**Automated pass rate: 58%.** The charter requires 90%. (Was 50% / 7 broken before the
`p-chino` fix.)

This does not block Sprint 1 (no links are rendered yet), but it **must be closed in
Sprint 2 before Story 8 is marked done**, and re-verified before 12/08. The seven
broken URLs are listed below with the required action. Do not quietly delete the
products — several outfits depend on them; replace the URL with the closest current
product page instead.

### Broken — must be replaced (Story 8 blocker)

| Product | Current URL | Status | Action |
|---|---|---|---|
| `p-moto` | zara.com/us/en/leather-moto-jacket-p05634024.html | 404 | Zara uses hashed refs; find current moto jacket page |
| `p-tux-blazer` | theory.com/womens-blazers/structured-tuxedo-blazer.html | 410 | Product retired; substitute closest Theory blazer |
| `p-wool-blazer` | massimodutti.com/us/wool-blend-blazer-l00432085 | 404 | Find current blazer ref |
| `p-cargo` | dickies.com/pants/relaxed-fit-cargo-pants/FP01.html | 404 | Find current women's cargo page |
| `p-sneakers` | vans.com/en-us/shoes-c00081/authentic-shoe-pvn000ee3baq | 404 | Find current Authentic product ref |
| `p-pumps` | samedelman.com/product/womens-hazel-pump-30195/… | 404 | Find current Hazel pump page |
| `p-chino` | ~~uniqlo.com/us/en/products/E455402-000/00~~ | **Fixed** | Replaced with verified `E461663-000/00` |

After replacing those six, the projected rate is **21 reachable / 26 = 81%**, still
short of 90%. If the five bot-blocked links verify by hand as working, the rate becomes
**26/26 = 100%**, which clears the bar comfortably. **The manual pass is therefore not
optional** — it is the difference between passing and failing a charter success
criterion.

Practical implication: the fastest path to passing is the manual verification pass
(5 minutes with a browser, assuming the pages load), not more automated fixing.

### Inconclusive — verify in a browser

`p-draped-top` (Mango, 403) · `p-cashmere` (Everlane, 429) · `p-linen-trouser`
(Everlane, 429) · `p-loafers` (G.H. Bass, 429) · `p-sandals` (Mango, 403)

These are large retailers that block automated requests. A 403 from a bot filter says
nothing about whether the page loads for a person.

---

## How to run the audit

A repeatable checker is included:

```bash
cd app && npm run audit:links
```

It reads `catalog.json`, issues a `HEAD` request (falling back to `GET`) for each
non-null `productUrl`, and reports status codes. Retailers frequently block automated
requests, so a `403`/`429` is **inconclusive rather than broken** — those must be
confirmed by hand.

**Manual verification is required before the Sprint 2 completion.** Open each URL in a
browser, confirm the product page loads and the product matches the catalog entry
(name, roughly the price, correct retailer), then record the result below.

---

## Verification status

| Product ID | Retailer | URL present | Automated check | Manual check | Notes |
|---|---|---|---|---|---|
| `p-tee-cotton` | Uniqlo | ✅ | ⬜ Pending | ⬜ Pending | Uniqlo deep-links are stable but block bots |
| `p-breton` | Uniqlo | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-poplin` | ARKET | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-rib-crew` | COS | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-silk-cami` | Reformation | ✅ | ⬜ Pending | ⬜ Pending | Reformation rotates seasonal SKUs — recheck closest to 12/08 |
| `p-draped-top` | Mango | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-rib-tank` | Weekday | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-cashmere` | Everlane | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-satin-cami` | & Other Stories | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-wool-blazer` | Massimo Dutti | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-tux-blazer` | Theory | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-moto` | Zara | ✅ | ⬜ Pending | ⬜ Pending | Zara uses hashed product refs; verify manually |
| `p-denim-jacket` | Levi's | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-straight-trouser` | COS | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-chino` | Uniqlo | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-midi-skirt` | ARKET | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-crepe-trouser` | Banana Republic | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-cargo` | Dickies | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-linen-trouser` | Everlane | ✅ | ⬜ Pending | ⬜ Pending | **Edge case:** `price: null`. Link may still be valid. |
| `p-silk-skirt` | Reformation | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-loafers` | G.H. Bass | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-sneakers` | Vans | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-slip-on` | Old Navy | ✅ | ⬜ Pending | ⬜ Pending | Cheapest footwear; keeps two casual outfits under $90 |
| `p-sandals` | Mango | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-pumps` | Sam Edelman | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-scarf` | & Other Stories | ✅ | ⬜ Pending | ⬜ Pending | |
| `p-hoops` | Mejuri | ❌ **null** | n/a | n/a | **Edge case:** no valid page. Story 8 requires the shop link be *hidden*, never rendered as a broken or placeholder link. |

**Total products:** 27 · **With URL:** 26 · **Null URL:** 1 (`p-hoops`)

### Running pass rate

`0 / 26 verified` — audit not yet executed. Target is ≥ 24 / 26 (90%).

---

## Interpretation rules for Sprint 2

These matter because a naive reading of "no broken link" leads to bad UI:

1. **A null URL is not a failure — it is a correct state.** `p-hoops` intentionally has
   no link. The Story 8 criterion is satisfied by *hiding or disabling* the control, not
   by inventing a search-results URL. Do not "fix" this row.
2. **A 403 from a bot-protected retailer is not a dead link.** Confirm by hand. Uniqlo,
   Zara, Mango, and Massimo Dutti commonly block automated requests.
3. **A seasonal 404 is a real failure.** Reformation, ARROW, and fast-fashion
   retailers rotate SKUs. If a page 404s, replace the URL with the closest current
   product rather than deleting the item, since the outfit depends on it.
4. **Re-run the audit close to 12/08.** A link verified on 11/18 can rot by 12/08.
   Budget one pass in the Sprint 3 fix window.
5. **Record the retrieval date.** Every product carries `priceRetrievedAt` and the
   catalog carries a top-level `priceRetrievedAt`. Story 7's
   `"Sample Price — Retrieved [Date]"` badge reads from these, and the charter risk
   register requires we display when information was retrieved.

---

## Sample price disclaimer

Prices are curated samples captured on `2026-11-18`, not live retailer pricing. The
prototype footers state this in the UI, and Story 7 will add a per-item
`"Sample Price — Retrieved 2026-11-18"` badge when prices are first rendered in
Sprint 2. No price is ever inferred or interpolated.
