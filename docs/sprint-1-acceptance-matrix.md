# VibeFit Sprint 1 — Acceptance Matrix

Every Sprint 1 acceptance criterion, mapped to the code that implements it and the
test that proves it. Use this document to verify your own story (VIBE-11, VIBE-13,
VIBE-14, VIBE-15, VIBE-8) before the sprint review.

**Status at time of writing:** all 20 Sprint 1 criteria verified.
**Commands:** `cd app && npm test` (115 tests) · `npm run typecheck` · `npm run build`

---

## Epic 1 — User Preferences

### VIBE-11 · Select Occasion

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| 11.1 | View options: Casual Outing, Work, Party, Wedding | [`OccasionSelector.tsx`](../app/src/features/preferences/OccasionSelector.tsx) renders `OCCASIONS` from [`domain.ts`](../app/src/types/domain.ts) as a 2×2 bento grid | `flow.test.tsx` → *renders all four occasions* |
| 11.2 | Select one occasion and continue | `BentoTile` with `aria-pressed`; store `setOccasion` | `flow.test.tsx` → *marks the selected occasion with aria-pressed* |
| 11.3 | Clear validation message if missing | [`validation.ts`](../app/src/features/preferences/validation.ts) `MESSAGES.occasion`, surfaced via `FieldError` with `role="alert"` | `flow.test.tsx` → *shows a clear validation message when occasion is missing* |
| 11.4 | Occasion retained when recommendations generated | Zustand store; `generate()` reads `preferences.occasion` without mutation | `flow.test.tsx` → *generates recommendations…* asserts `preferences.occasion === 'Wedding'` |

**Design note.** Four options in a 2×2 grid rather than radios: all choices visible,
one click to select. The selection ring is a shared `layoutId` element that travels
between tiles, so the change reads as one object moving rather than two fades.

### VIBE-13 · Select Dress Code

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| 13.1 | Clearly labeled dress-code options | [`DressCodeSelector.tsx`](../app/src/features/preferences/DressCodeSelector.tsx), all 5 `DRESS_CODES`, each with a formality descriptor | `flow.test.tsx` → *renders five labelled options* |
| 13.2 | Dress code saved with preferences | Store `setDressCode` → persisted `vibefit:sprint1:v1` | `preferencesStore.test.ts` → *round-trips preferences through localStorage* |
| 13.3 | Changeable before requesting recommendations | Selector stays mounted and enabled at all times | `flow.test.tsx` → *saves the choice and allows changing it* |
| 13.4 | Recommendations use the selected dress code | [`recommend.ts`](../app/src/engine/recommend.ts) hard filter stage 2 | `recommend.test.ts` — every scenario asserts `outfit.dressCodes` contains the chosen code |

**Design note.** Presented as a formality ladder (less formal → more formal) with a
single gold dot that slides along a rail. This is not decoration: it makes AC 13.3
visibly true at a glance, and helps a user who is unsure between two adjacent codes
understand the relationship.

### VIBE-14 · Set Outfit Budget

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| 14.1 | Enter budget in US dollars | [`BudgetInput.tsx`](../app/src/features/preferences/BudgetInput.tsx) — `inputMode="decimal"`, `$` affordance, `USD` suffix | `flow.test.tsx` → *accepts a USD amount* |
| 14.2 | Reject zero, negative, non-numeric with helpful message | [`validateBudget()`](../app/src/features/preferences/validation.ts) — 12-case matrix: empty, whitespace, `0`, `$0`, `0.00`, negative, `-$50`, letters, mixed text, stray decimal, bare minus, over-max | `validation.test.ts` (12 rejection + 7 acceptance cases), `flow.test.tsx` → non-numeric / zero / negative |
| 14.3 | Budget saved on continue | `setBudgetInput` parses on every keystroke; `budget` numeric mirror only set when valid | `preferencesStore.test.ts` → *stores the parsed number only when the input is valid* |
| 14.4 | Suggestions respect budget where price is known | [`recommend.ts`](../app/src/engine/recommend.ts) hard filter stage 3; unknown prices excluded from the sum | `recommend.test.ts` — each of 10 scenarios asserts `knownTotal <= budget` |

**Design note.** The input is deliberately *not* sanitised down to digits. Stripping
letters would make AC 14.2 undemonstrable — "250 dollars" would quietly become "250"
with no message. The field now accepts what the user types and explains the problem,
which is both honest and testable. The tier bar beside it is a hint only and writes
nothing.

### VIBE-15 · Choose Style & Color Preferences

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| 15.1 | Choose at least one style | [`StyleColorSelector.tsx`](../app/src/features/preferences/StyleColorSelector.tsx) multi-select pills + validation | `flow.test.tsx` → *requires at least one style* |
| 15.2 | Choose colors OR explicitly no preference | Colour swatches + a distinct `No Color Preference` pill; exclusivity enforced in the store | `flow.test.tsx` → *keeps No Color Preference exclusive*; `preferencesStore.test.ts` → 3 exclusivity tests |
| 15.3 | Preferences remain visible when returning to edit | Single persisted store, no screen-local copies | `flow.test.tsx` → *returns to preferences without losing selections* (asserts all five selections) |
| 15.4 | Recommendations account for preferences | [`score.ts`](../app/src/engine/score.ts) style/colour weighting; hard filters for style and colour | `recommend.test.ts` — scenario assertions + reason-chip presence |

**Design note.** Style is an abstract taste, so it gets text pills. Colour is
perceptual, so it gets real swatches. `No Color Preference` is a separate,
full-width, visually distinct control rather than a seventh swatch, because it is a
different *kind* of answer.

---

## Epic 2 — AI Outfit Recommendations

### VIBE-8 · Generate Outfit Recommendations

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| 8.1 | Request recommendations after required inputs | `validateAll()` gate on *Generate outfits* in [`PreferencesPage.tsx`](../app/src/features/preferences/PreferencesPage.tsx) | `flow.test.tsx` → full-flow tests; `preferencesStore.test.ts` → *validation reports every missing field* |
| 8.2 | Suggestions based on occasion, dress code, style, budget | Five ordered hard filters in [`recommend.ts`](../app/src/engine/recommend.ts) | `recommend.test.ts` → **10/10 charter scenarios pass** (charter requires 8/10) |
| 8.3 | Each suggestion identifiable as a distinct outfit | Unique `outfit.id` + name + `aria-label`; diversity pass maximises top-garment variety | `recommend.test.ts` → *keeps outfit identities unique*; `flow.test.tsx` → distinct accessible names |
| 8.4 | Clear message instead of empty/broken screen | [`EmptyState.tsx`](../app/src/features/results/EmptyState.tsx) + `ErrorBoundary`; relax options computed by [`relax.ts`](../app/src/engine/relax.ts) | `flow.test.tsx` → *shows a helpful empty state with working escape hatches* (clicks a relax tile and asserts results appear) |

**Charter scenario results — all 10:**

| # | Occasion | Dress code | Budget | Styles | Colors | Expected | Actual |
|---|---|---|---|---|---|---|---|
| 1 | Casual Outing | Casual | $120 | Minimalist | Beige | ≥2 | ✅ |
| 2 | Work | Business Formal | $400 | Classic | Navy | ≥2 | ✅ |
| 3 | Party | Cocktail | $250 | Trendy | Black | ≥2 | ✅ |
| 4 | Wedding | Black Tie | $500 | Classic | Black | ≥2 | ✅ |
| 5 | Work | Business Formal | $80 | Streetwear | Colorful | 0 (empty state) | ✅ |
| 6 | Wedding | Cocktail | $250 | Bohemian | No Color Preference | ≥2 | ✅ |
| 7 | Casual Outing | Smart Casual | $150 | Streetwear | No Color Preference | ≥2 | ✅ |
| 8 | Party | Casual | $200 | Bohemian | Earth Tones | ≥1 | ✅ |
| 9 | Work | Smart Casual | $300 | Minimalist | Beige | ≥3 | ✅ |
| 10 | Casual Outing | Casual | $90 | Trendy | White | ≥1 | ✅ |

**A note on scenario 5.** No single-field relaxation recovers it: dropping style
alone still leaves the colour filter, dropping colour alone still leaves style, and
$80 cannot cover Business Formal tailoring either way. The empty state therefore
escalates from single-field fixes to *progressive combinations*, and only ever shows
options that the engine confirms will produce results. Without that escalation the
empty state would have rendered zero buttons — precisely the dead end AC 8.4 forbids.

### Story 9 (state foundation, not claimed complete)

Story 9 (Refine) is not on the Sprint 1 board, but AC 8.4 and the retention
requirements of 11.4 / 13.3 / 15.3 cannot be met without the same state work. The
foundation is in place and tested; the remaining Story 9 UI is Sprint 2.

| AC | Requirement | Status |
|---|---|---|
| 9.1 | Return to preference inputs from results | ✅ *Edit preferences* button, `flow.test.tsx` |
| 9.2 | Change one preference without clearing others | ✅ partial-patch store, `preferencesStore.test.ts` |
| 9.3 | Regenerating updates suggestions | ✅ chat-driven refresh + explicit regenerate, `flow.test.tsx` |
| 9.4 | Helpful message when no match | ✅ `EmptyState`, `flow.test.tsx` |

---

## Charter — Conversational Styling Assistant

The charter's 11/17 milestone names the conversational assistant as a Sprint 1
deliverable. It is implemented as a deterministic on-device parser.

| Requirement | Implementation | Verification |
|---|---|---|
| Natural-language input updates the four preference states | [`parseIntent.ts`](../app/src/features/chat/parseIntent.ts) | `parseIntent.test.ts` — 24 utterances |
| Follow-up *"Show me a cheaper option"* | Reduces budget by 20% of the current value | `parseIntent.test.ts` → *lowers the budget by roughly 20%* |
| Multi-field from one sentence | Wedding + cocktail + $250 + minimalist + no colour, all in one pass | `parseIntent.test.ts` → *populates several preferences from one sentence* |
| Does not clear unrelated fields | Only mentioned fields are patched | `parseIntent.test.ts` → *does not touch unrelated fields* |
| Clarifying question when details are missing | Names the specific missing pieces | `parseIntent.test.ts` → *asks a specific clarifying question* |

**Why no LLM call.** Three reasons, all of which protect the deliverable: the demo
cannot fail on a rate limit or a bad connection in the lecture hall; behaviour is
deterministic and therefore unit-testable; and every interpretation is explainable to
a reviewer. The `parseChatMessage(text, current)` signature is the seam where a
model-backed implementation can replace the rules in Sprint 2 without touching the UI.

---

## Cross-cutting

| Concern | Evidence |
|---|---|
| Animation never owns behaviour | `motion.test.ts` (8 tests) asserts every preset collapses to a no-op under Vitest and reduced motion |
| Semantic HTML and ARIA | `flow.test.tsx` asserts `aria-pressed`, `aria-invalid`, `aria-describedby` resolving to a real `role="alert"` node |
| Colour contrast | `tokens.test.ts` (11 tests) guards the shipped combinations |
| No invented prices | `recommend.test.ts` → unknown price excluded from totals, `priceComplete` false |
| Deterministic ranking | `recommend.test.ts` → identical ordering across runs |
| Broken screen impossible | `ErrorBoundary`, route guard redirect, empty state — all three reachable paths tested |
| Data integrity | Catalog validated by Zod at import; a malformed row throws rather than rendering blank |

---

## Sprint 2 boundaries (deliberately not built)

These are excluded so the sprint stayed honest. Each has its data already in place:

| Feature | Story | Ready in catalog | UI status |
|---|---|---|---|
| Itemised prices, Total Outfit Price | 7 | `price` + `priceRetrievedAt` on every product | Not built |
| `Price Unavailable` for `price: null` | 7 | `p-linen-trouser` | Not built |
| `Sample Price — Retrieved [Date]` badge | 7 | `catalog.priceRetrievedAt` | Not built |
| `Shop at [Retailer]` links | 8 | `productUrl` (null on `p-hoops`) | Not built |
| Outfit detail view | 6 | `SLOT_LABELS`, full item lists | Not built |
| Combined-look preview | 10 | `heroImage` nullable | Not built |
| AR camera try-on | 10 | 5 × `arSupported` + `overlayAsset` paths | Not built |

The `AR Ready` badge on result cards is data-driven off `arSupported` and worded as
*readiness*, never as an available feature, so the prototype does not overstate scope
to the sponsor.
