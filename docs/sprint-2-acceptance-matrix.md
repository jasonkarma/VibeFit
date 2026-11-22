# VibeFit Sprint 2 — Acceptance Matrix

Every Sprint 2 acceptance criterion, mapped to the code that implements it and the
test that proves it. Use this document to verify your own story (VIBE-6, VIBE-7,
VIBE-8b, VIBE-10) before the 11/24 milestone review.

**Status at time of writing:** all 21 Sprint 2 criteria verified, plus the 6
charter AR requirements.
**Commands:** `cd app && npm run typecheck` · `npm test` (240 tests) · `npm run build`
**Sprint 1 baseline preserved:** the Sprint 1 suite (`sprint-1-acceptance-matrix.md`,
159 tests) still passes unmodified except for one added round-trip test.

---

## Route map added in Sprint 2

| Route | Component | Story |
|---|---|---|
| `/results` | `ResultsPage` | Story 5 (unchanged), now navigates onward |
| `/results/:outfitId` | [`OutfitDetailPage.tsx`](../app/src/features/outfit/OutfitDetailPage.tsx) | Story 6, 7, 8 |
| `/results/:outfitId/preview` | [`PreviewPage.tsx`](../app/src/features/preview/PreviewPage.tsx) | Story 10, charter AR |

---

## VIBE-6 · View Outfit Details

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| **6.1** | Every outfit card opens `/results/:outfitId` | [`OutfitCard.tsx`](../app/src/features/results/OutfitCard.tsx) overlay button → [`ResultsPage.tsx`](../app/src/features/results/ResultsPage.tsx) `handleOpenOutfit` → `navigate()`; routes declared in [`App.tsx`](../app/src/App.tsx) | `outfitDetail.test.tsx` → *opens the detail route from a result card*; `flow.test.tsx` → *opens a detail page and returns without regenerating results* |
| **6.2** | Header, Opus 5.5 / engine rationale, budget-fit breakdown | `OutfitDetailPage` header block; [`RationalePanel.tsx`](../app/src/features/outfit/RationalePanel.tsx) with a `Opus 5.5 Live` / `Local Engine` provenance badge; [`BudgetMeter`](../app/src/components/ui/BudgetMeter.tsx) in the sidebar | `outfitDetail.test.tsx` → *renders the header, styling rationale and budget breakdown* (asserts `role="meter"` and the provenance badge) |
| **6.3** | Itemised grid of every piece, `Prototype Visual` badge on placeholder imagery | `OutfitDetailPage` `motion.ul` → [`OutfitItemCard.tsx`](../app/src/features/outfit/OutfitItemCard.tsx) → [`PrototypeVisual.tsx`](../app/src/components/ui/PrototypeVisual.tsx) | `outfitDetail.test.tsx` → *lists every garment piece with a Prototype Visual badge* (asserts one badge per piece and every `data-testid`) |
| **6.4** | `Back to Recommendations` returns to `/results` with preferences **and** cached results intact | Button in `OutfitDetailPage`; results live only in the persisted store; `ResultsPage` re-generation guard (see D9 below) | `outfitDetail.test.tsx` → *preserves preferences AND the cached result set on back navigation* — asserts `lastGeneratedAt` is **identical** and the outfit id list is unchanged |

**Design note.** The rationale panel separates two signals that are tempting to
merge: the engine's deterministic reason chips (always present, always true) and the
Opus 5.5 narrative (personal, available only when a live key exists and only for the
generation it was produced against). The provenance badge states which one is on
screen, because implying the model wrote the engine's text would be a small lie that
a sponsor could catch in the demo.

**On D9 (the one behaviour fix).** `ResultsPage` previously re-ran `generate()` on
every mount, which meant returning from a detail page silently cleared `aiReasons`
and `aiOrder` and re-billed a live API call. The effect is now keyed on a
preference-signature ref, so it fires only on a genuine preference change. AC 6.4
is now structurally true rather than coincidentally true — and a test asserts the
timestamp equality that proves it.

---

## VIBE-7 · Itemised USD Pricing

All pricing logic lives in [`src/lib/pricing.ts`](../app/src/lib/pricing.ts) as a
pure module. `summarisePricing` returns a **discriminated union**, so a partial
total cannot be rendered as a total without a type error first.

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| **7.1** | Each item price as `$XX.XX` in `JetBrains Mono` | `formatItemPrice` (cents precision) + `font-data` class on the price node | `pricing.test.ts` → *renders two decimal places with a dollar sign*; `outfitDetail.test.tsx` → *renders each known price as $XX.XX in the mono role* |
| **7.2** | All prices numeric → Total Outfit Price compared to budget | `PricingSummary{kind:'complete'}` → `budgetVerdict` → `BudgetMeter` + verdict line | `pricing.test.ts` → *reports a complete total*, *reports headroom*, *reports the overage*; `outfitDetail.test.tsx` → *shows a complete total compared against the budget* ($465 vs $400 → "over your budget") |
| **7.3** | Any `price: null` → `Price Unavailable`, total flagged partial, price never invented | `PricingSummary{kind:'partial'}` → *Known subtotal* heading + `partial-total-notice`; the item branch contains **no dollar sign at all** | `pricing.test.ts` → *excludes a null price from the sum and flags the summary partial*, *never substitutes a number*, *returns null for an unknown price*; `outfitDetail.test.tsx` → *flags a partial total for the seeded null-price item* — asserts the card's text contains no `$` |
| **7.4** | Visible `Sample Price • Retrieved [Date]` indicator | `samplePriceLabel` rendered under every known price | `pricing.test.ts` → 3 cases including the missing-date fallback; `outfitDetail.test.tsx` → *shows the Sample Price retrieval indicator* asserting `Sample Price • Retrieved 2026-11-18` |

**The rule that matters.** A `null` price is excluded from the sum and reported as
unknown. There is no `0`, no estimate, no range midpoint, no `~`, and no "from $0".
Ten tests guard this, and the type system makes the accidental version a compile
error rather than a review comment.

**Seeded edge case:** `p-linen-trouser` (via outfit `o-12`) carries `price: null`.
Opening `/results/o-12` demonstrates the whole path.

---

## VIBE-8b · Retailer Shopping Links

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| **8b.1** | Valid `productUrl` → `Shop at [Retailer]`, new tab, `rel="noopener noreferrer"` | [`OutfitItemCard.tsx`](../app/src/features/outfit/OutfitItemCard.tsx) `<a>`; `shopLinkLabel`; `hasShoppingLink` guard | `outfitDetail.test.tsx` → *renders a safe external link per item with a URL* — asserts `href`, `target="_blank"`, and both rel tokens |
| **8b.2** | `productUrl: null` → no clickable link, subtle `Link Unavailable` label | `hasShoppingLink` returns false → text branch, no anchor rendered | `outfitDetail.test.tsx` → *suppresses the link entirely for the seeded null-URL item* — asserts **zero** anchors in the card and `data-link-available="false"`; `pricing.test.ts` → rejects null/empty/whitespace/relative/`javascript:` values |

**Seeded edge case:** `p-hoops` carries `productUrl: null`. It was previously in no
outfit, so the criterion was unreachable in the UI; it now sits in `o-08`
(Boardroom Standard), which exercises null-URL suppression, complete pricing and AR
support in a single screen.

**Why no disabled link.** `href="#"` or an `aria-disabled` anchor both look
clickable and lie about it. The absence of an anchor is the honest representation,
and it is asserted rather than assumed.

---

## VIBE-10 · Dual-Mode Outfit Preview & AR Try-On

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| **10.1** | Prominent `Preview & AR Try-On` on detail; close returns to detail | CTA in `OutfitDetailPage` (rendered only when the outfit has a supported garment) → `/results/:outfitId/preview`; `Close preview` → back to detail | `outfitDetail.test.tsx` → *offers Preview & AR Try-On only when the outfit has a supported garment*, *navigates into the preview route*; `preview.test.tsx` → *renders both tabs and closes back to the outfit detail* |
| **10.2** | Tab 1 — all pieces assembled, labelled `Illustrative Prototype Preview` | [`CombinedLook.tsx`](../app/src/features/preview/CombinedLook.tsx) | `preview.test.tsx` → *assembles every piece under the prototype label* (asserts the exact label text, 5 pieces, and the "not product photography" note) |
| **10.3** | Tab 2 — live `getUserMedia` overlay for the **5 `arSupported` tops/jackets**, switchable | [`useCameraStream.ts`](../app/src/features/preview/useCameraStream.ts); [`arGarments.ts`](../app/src/features/preview/arGarments.ts) derives them from the catalog; [`GarmentSwitcher.tsx`](../app/src/features/preview/GarmentSwitcher.tsx) | `arGarments.test.ts` (10 tests, incl. exactly-five and asset-present invariants); `preview.test.tsx` → *offers all five supported tops and jackets*, *selects the outfit's own garment by default and switches on click* |
| **10.4** | **Privacy consent gate** before `getUserMedia`: explicit card, video stays local, zero upload/retention | [`ConsentCard.tsx`](../app/src/features/preview/ConsentCard.tsx) — the only path to `request()`, which is the only caller of `getUserMedia` | `preview.test.tsx` → *never touches getUserMedia before consent*, *states that video stays local with no retention or upload*, *requests the camera exactly once after explicit consent* (also asserts `audio: false`), *never calls fetch anywhere in the AR flow* |
| **10.5** | Denial / unavailable devices handled gracefully with an interactive silhouette fallback | `useCameraStream` status machine + `classifyCameraError` → `CAMERA_FAILURE_COPY` → `SilhouetteStage`; controls stay live | `preview.test.tsx` → 4 tests: `NotAllowedError` → denial copy + silhouette + overlay + controls; `NotFoundError` → no-camera copy; no `mediaDevices` → not-supported copy; `NotReadableError` → busy-device copy |
| **10.6** | Scale, horizontal offset, vertical offset, opacity controls | [`AlignmentControls.tsx`](../app/src/features/preview/AlignmentControls.tsx) + [`overlayTransform.ts`](../app/src/features/preview/overlayTransform.ts) | `preview.test.tsx` → *applies scale, horizontal, vertical and opacity to the overlay* (reads the live `transform`/`opacity`), *live numeric readout and reset*, *labels each control for assistive technology*; `overlayTransform` maths tested directly incl. clamping of out-of-range and `NaN` |
| **10.7** | Disclaimer: *"Visual appearance preview only — does not guarantee exact sizing or fit."* | `FIT_DISCLAIMER` rendered in the preview footer, **outside** both tab panels | `preview.test.tsx` → *is present in the combined look tab* and *is present in the AR tab too* — asserts the string verbatim |

---

## Charter — AR virtual try-on scope

| Charter requirement | Implementation | Verification |
|---|---|---|
| Exactly 5 supported tops/jackets | `arSupported: true` + `overlayAsset` in [`catalog.json`](../app/src/data/catalog.json): cashmere crewneck, wool blazer, tuxedo blazer, leather moto, denim jacket | `arGarments.test.ts` → *contains exactly five supported tops and jackets*, *only offers top and layer slots*, *gives every garment a real overlay asset*, *matches the catalog exactly* |
| Camera use is opt-in and explained | Consent card precedes any device API call; silhouette mode never requests at all | `preview.test.tsx` → consent suite + *choosing silhouette mode never requests the camera* |
| No image leaves the browser | Overlay is composited in the DOM; no `fetch`, `FormData`, canvas export or `MediaRecorder` exists in the feature | `preview.test.tsx` → *never calls fetch anywhere in the AR flow* (spy asserted across the whole granted-camera flow) |
| Camera never left running | `useCameraStream` stops every track on `stop()` and on unmount | `preview.test.tsx` → *releases every track when the camera is stopped* (both tracks' `stop` spies called), *stops tracks on unmount* |
| Honest about fidelity | `Prototype Visual` badges, `Illustrative Prototype Preview` label, persistent sizing disclaimer, manual alignment controls | `preview.test.tsx`, `outfitDetail.test.tsx` |
| Graceful degradation in a live demo | Silhouette mode is a first-class mode with a one-click entry point, not an error state | 4 failure-path tests, all landing on a usable stage |

**On the nature of this try-on.** Real virtual try-on needs pose estimation over a
live video stream. This sprint delivers a 2D overlay compositor: a transparent
garment asset positioned over the video (or silhouette) with user-driven alignment.
The gesture is isolated in `overlayTransform.ts` → a single `OverlayTransform` value,
which is exactly the seam a pose model would later write into. The plan records this
trade explicitly (decision in `plans/sprint-2-plan.md` §3) rather than letting the
feature imply fit-accurate sizing it cannot deliver.

---

## Cross-cutting

| Concern | Evidence |
|---|---|
| **Design system unchanged** | No new hex values: new components use `champagne`, `violet`, `obsidian-*`, `fit-*` utilities from `tailwind.config.ts`. `tokens.test.ts` (11 tests) still guards contrast. |
| **Prices and metrics in `JetBrains Mono`** | `font-data` used for every price, total, percentage and metric readout — asserted directly in `outfitDetail.test.tsx` (`expect(priceNode.className).toContain('font-data')`). |
| **Motion from one vocabulary** | No new presets. New screens compose `pageTransition`, `staggerContainer`, `cardReveal` from [`lib/motion.ts`](../app/src/lib/motion.ts). `motion.test.ts` (8 tests) still passes: every preset collapses under Vitest and reduced motion. |
| **Overlay is direct-manipulation** | Overlay `transform`/`opacity` are set inline and **not** animated, so dragging a slider feels 1:1. Only `transform` and `opacity` are used, per the Sprint 1 performance rule. |
| **Semantic HTML** | Item grid is `motion.li` inside `motion.ul` (not `div` inside `ul`); preview tabs are `role="tablist"` / `role="tab"` with `aria-selected` and `aria-controls`; sliders are native `input[type=range]` with real `<label for>`, `<output>` and `aria-valuetext`; shop links are real `<a>` elements. |
| **Deep links never dead-end** | [`engine/lookup.ts`](../app/src/engine/lookup.ts) resolves from the catalog when the cache is cold; unknown ids render an explicit not-found card. `lookup.test.ts` (8 tests) covers both. |
| **No broken route on refresh** | Both new routes redirect to `/preferences` without required inputs — same guard as Sprint 1. `outfitDetail.test.tsx` → *redirects to preferences when the route is opened with no inputs*. |
| **No invented data anywhere** | Prices: `null` excluded, partial totals labelled. Links: `null` suppressed. Imagery: every visual badged as a prototype. Rationale: provenance badge states live vs local. |

---

## Manual verification steps (for the 11/24 demo dry run)

Camera behaviour cannot be fully asserted in jsdom, so do these once on the
presentation machine:

1. `cd app && npm run dev`, open `http://localhost:5173` (localhost is a secure
   context, which `getUserMedia` requires — a plain-HTTP LAN host will not work).
2. Preferences → Work / Business Formal / $400 / Classic / Navy → **Generate outfits**.
3. Open **Boardroom Standard** (`o-08`). Confirm: five pieces each badged
   *Prototype Visual*, `$59.00` / `$139.00` / … in mono, `$465.00` total with
   "over your budget", a `Shop at ARKET` button, and **Link Unavailable** on the
   gold hoops (no anchor).
4. **Back to Recommendations** — confirm the grid is identical and no network call
   to `/api/lumia` fires (DevTools → Network).
5. Open **Neutral Layers** (`o-12`) and confirm **Known subtotal $208.00** with the
   amber *lower bound* notice and *Price Unavailable* on the linen trousers.
6. Back to `o-08` → **Preview & AR Try-On** → *Combined look* tab shows all pieces
   under **Illustrative Prototype Preview**; the sizing disclaimer is visible.
7. *AR try-on* tab: confirm **no camera prompt** appears until **Enable camera** is
   clicked. Allow it, verify live video + overlay, then drag all four sliders.
8. Deny the permission on a second run (or use *Use silhouette mode instead*) and
   confirm the silhouette stage, the overlay and all four controls still work.
9. Confirm the camera indicator light goes out after **Stop camera** and after
   navigating back.

---

## Definition of Done — status

| # | Requirement | Status |
|---|---|---|
| 1 | All Sprint 2 ACs mapped to code and tests | ✅ this document |
| 2 | `typecheck`, full suite, production build pass | ✅ 240/240 tests, clean typecheck |
| 3 | Every card navigates; back preserves cached results | ✅ AC 6.1, 6.4 |
| 4 | No `null` price ever produces a dollar figure | ✅ AC 7.3, 10 tests |
| 5 | `productUrl: null` renders no anchor | ✅ AC 8b.2 |
| 6 | No `getUserMedia` before consent; no `fetch`; no leaked tracks | ✅ AC 10.4, charter |
| 7 | Denied / unavailable / unsupported all reach a working silhouette | ✅ AC 10.5, 4 tests |
| 8 | Disclaimer visible in both tabs | ✅ AC 10.7 |
| 9 | Design system unchanged | ✅ see Cross-cutting |
| 10 | Demo script updated | ✅ [`demo-script-sprint-2.md`](demo-script-sprint-2.md) |
