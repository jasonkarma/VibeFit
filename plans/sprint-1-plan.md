# VibeFit — Sprint 1 Implementation Plan

**Sprint:** VIBE Sprint 1 · 10 Nov – 17 Nov 2026
**Charter milestone:** 11/17/2026 — *Sprint 1: conversational styling assistant and initial outfit recommendations*
**Build target:** MSIS-609 working prototype, final demo 12/08/2026
**Plan status:** proposed — pending two scope confirmations (see [Open Decisions](#open-decisions))

---

## 1. What the board actually contains

| Jira Key | Story | Epic | Priority | Points | Assignee | Board Status |
|---|---|---|---|---|---|---|
| VIBE-11 | Select Occasion | User Preferences | 1 | 2 | TC | In Progress |
| VIBE-13 | Select Dress Code | User Preferences | 2 | 1 | TC | In Progress |
| VIBE-14 | Set Outfit Budget | User Preferences | 3 | 2 | LA | To Do |
| VIBE-15 | Choose Style Preferences | User Preferences | 4 | 3 | NN | In Progress |
| VIBE-8 | Generate Outfit Recommendations | AI Outfit Recommendations | 5 | 8 | E | To Do |

**Committed:** 5 items / **16 story points**. The header badge showing `10` does not match the 16-point sum — confirm whether that badge is remaining points, a version label, or a stale count before the Sprint review (it is a reporting discrepancy, not a build blocker).

**Deferred to Sprint 2 (charter 11/24):** View Outfit Details (VIBE-6 equiv.), View Product Prices, Open Shopping Links, Preview Selected Outfit, AR try-on. **Do not build these in Sprint 1** — but the catalog and types must be shaped now so Sprint 2 is additive only.

**Timeline note:** the sprint ended 11/17 and today is 11/18 with 0 items Done. Recommend re-baselining the Sprint 1 end date to 11/19 in Jira and keeping the Sprint 2 start on 11/18, so the 12/08 final presentation is not pushed. Record it as a one-day slip in the team notes.

---

## 2. Acceptance-criteria traceability (the contract for this sprint)

Every line below must be demonstrable and covered by an automated test or a written manual step in [`docs/sprint-1-acceptance-matrix.md`](docs/sprint-1-acceptance-matrix.md).

| AC | Requirement | Implementation home | Verification |
|---|---|---|---|
| **11.1** | View occasion options: Casual Outing, Work, Party, Wedding | [`src/features/preferences/OccasionSelector.tsx`](src/features/preferences/OccasionSelector.tsx) | render test asserts 4 options |
| **11.2** | Select one occasion and continue | same + [`src/features/preferences/validation.ts`](src/features/preferences/validation.ts) | RTL click-through test |
| **11.3** | Clear validation message when occasion missing | [`src/features/preferences/validation.ts`](src/features/preferences/validation.ts) | test asserts message text + `aria-invalid` |
| **11.4** | Occasion retained when recommendations generated | [`src/store/preferencesStore.ts`](src/store/preferencesStore.ts) | persistence test |
| **13.1** | Clearly labeled dress-code options | [`src/features/preferences/DressCodeSelector.tsx`](src/features/preferences/DressCodeSelector.tsx) | 5 options rendered with labels |
| **13.2** | Dress code saved with preferences | store | persistence test |
| **13.3** | Changeable before requesting recommendations | selector on preferences screen | RTL test |
| **13.4** | Recommendations use selected dress code | [`src/engine/recommend.ts`](src/engine/recommend.ts) | engine test per dress code |
| **14.1** | USD numeric budget input | [`src/features/preferences/BudgetInput.tsx`](src/features/preferences/BudgetInput.tsx) | render + input test |
| **14.2** | Reject 0, negative, non-numeric with helpful message | [`src/features/preferences/validation.ts`](src/features/preferences/validation.ts) | table-driven validation test |
| **14.3** | Budget saved on continue | store | persistence test |
| **14.4** | Suggestions respect budget where price is known | engine hard filter | engine test asserts `totalPrice <= budget` |
| **15.1** | Choose at least one style preference | [`src/features/preferences/StyleColorSelector.tsx`](src/features/preferences/StyleColorSelector.tsx) | min-1 validation test |
| **15.2** | Choose colors or "No Color Preference" | same | mutual-exclusivity test |
| **15.3** | Preferences remain visible when returning to edit | store + Edit Preferences round trip | round-trip test |
| **15.4** | Recommendations account for preferences | engine scoring | engine test asserts style/color relevance |
| **8.1** | Request recommendations after required inputs | results route guard | RTL test |
| **8.2** | Suggestions based on occasion, dress code, style, budget | engine | 10-scenario suite |
| **8.3** | Each suggestion identifiable as a distinct outfit | unique `outfit.id` + name on card | distinctness assertion |
| **8.4** | Clear message instead of empty/broken screen | [`src/features/results/EmptyState.tsx`](src/features/results/EmptyState.tsx) | empty-state test |
| **9.1** | Return to preference inputs from results | Edit Preferences action | RTL test |
| **9.2** | Change one preference without clearing others | partial-patch store actions | round-trip test |
| **9.3** | Regenerating updates suggestions | engine re-run on prefs change | test asserts different result set |
| **9.4** | Helpful message when no match | EmptyState | empty-state test |

> Note on cross-cutting AC: VIBE-9 (Refine) is **not** on the Sprint 1 board, but AC 8.4 and the retention requirements of 11.4/13.3/15.3 can only be satisfied by the same state and routing work. We implement the state foundation now so VIBE-9 in Sprint 2 is UI-only. Flag this as a dependency in the Sprint review rather than claiming VIBE-9 done.

---

## 3. Scope guard

**In Sprint 1**

- Project scaffold, routing, design primitives, error boundary
- Domain types + Zod schemas + full seed catalog (data only; no price/link UI)
- Persisted preference store (survives navigation and refresh)
- The four preference inputs with validation
- Recommendation engine with hard filters, scoring, reasons, empty state + relax actions
- Results screen with distinct outfit cards and an Edit Preferences round trip
- Conversational chat bar with a **deterministic local parser** (charter names this as a Sprint 1 deliverable)
- Vitest suite incl. the 10 charter test scenarios
- Acceptance matrix doc + 5-minute demo script

**Explicitly out of Sprint 1**

- Itemised price display, "$XX.XX" formatting, Total Outfit Price, "Sample Price — Retrieved [Date]" badge (Story 7 / Sprint 2)
- "Shop at [Retailer]" buttons (Story 8 / Sprint 2)
- Outfit Detail view, combined-look canvas, AR camera try-on (Sprint 2)
- Live scraping, any external AI API call, payment, auth

**Scope tension to be aware of:** Story 3 AC4 and Story 5 AC2 require the engine to respect *budget*, which requires prices in the catalog. So `catalog.json` carries real price values in Sprint 1 and the engine filters on them — we simply do not render itemised price UI until Sprint 2. Budget compliance is surfaced on the card as a short "Fits your $X budget" indicator, which is recommendation feedback, not the Story 7 price display.

---

## 4. Open decisions

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Vite + React Router vs Next.js App Router | **Vite + React Router** | SPA needs no SSR; `getUserMedia` and localStorage persistence are simpler; one static build target for the Sprint 2 AR work. Next is an easy swap if the team already has a Next repo. |
| D2 | App location | **`app/` subfolder** at repo root | Keeps [`VibeFit_10_User_Stories_Jira_Backlog.xlsx`](VibeFit_10_User_Stories_Jira_Backlog.xlsx), the charter PDF, and [`plans/`](plans/) separate from build output. |
| D3 | Chat bar in Sprint 1? | **Yes — deterministic parser only** | Charter line 87 names the conversational assistant as the Sprint 1 deliverable. No API key, no cost, never breaks the demo. An LLM adapter can drop behind the same interface in Sprint 2. |
| D4 | Ownership of the three "In Progress" items | Needs confirmation | VIBE-11/13/15 are assigned to TC and NN but this workspace is empty. If teammates have code elsewhere we must reconcile to one repo before building, or we will produce duplicate implementations. |
| D5 | Where prices come from | Curated `catalog.json` with `priceRetrievedAt` | Charter risk register requires "display when information was retrieved". Fits the $40 extraction budget line. |
| D6 | Recommendation "AI" | Deterministic hybrid: filter + weighted score + reason strings | Meets "explainable and testable" for the 8/10 scenarios criterion. Optional LLM re-ranking later. |

---

## 5. Architecture

```mermaid
flowchart LR
    A[Preferences Screen] --> V[Validate Required Inputs]
    V -->|invalid| A
    V -->|valid| E[Recommendation Engine]
    C[Chat Bar Parser] --> S[Persisted Preference Store]
    S --> A
    E --> R{Matches found}
    R -->|yes| L[Ranked Outfit Cards]
    R -->|no| M[Empty State plus Relax Actions]
    M --> E
    L --> P[Edit Preferences Round Trip]
    P --> S
    L --> T[Sprint 2 Outfit Detail and AR]
```

**Engine pipeline**

```mermaid
flowchart TD
    I[UserPreferences] --> F1[Hard filter occasion]
    F1 --> F2[Hard filter dress code]
    F2 --> F3[Hard filter budget total]
    F3 --> F4[Hard filter style overlap]
    F4 --> F5[Hard filter color unless no preference]
    F5 --> G{Any candidates}
    G -->|yes| H[Weighted scoring]
    H --> K[Diversity pass across outfits]
    K --> O[Ranked results with reasons]
    G -->|no| Q[Diagnostics per filter]
    Q --> Z[Relax strategy suggestions]
```

**State model.** One Zustand store with `persist` (localStorage key `vibefit:sprint1:v1`) holding `preferences`, `fieldErrors`, `results`, `lastGeneratedAt`, and `chatLog`. All mutations are **partial patches** (`setPreference('dressCode', x)`), which is what mechanically guarantees VIBE-13 AC3 and Story 9 AC2. No screen owns local preference state — otherwise the "don't clear other selections" AC breaks on remount.

---

## 6. Domain model and catalog

Types live in [`src/types/domain.ts`](src/types/domain.ts), validated by Zod at load time so a bad catalog row fails loudly in dev.

```ts
type Occasion   = 'Casual Outing' | 'Work' | 'Party' | 'Wedding';
type DressCode  = 'Casual' | 'Smart Casual' | 'Business Formal' | 'Cocktail' | 'Black Tie';
type StylePref  = 'Minimalist' | 'Classic' | 'Trendy' | 'Streetwear' | 'Bohemian';
type ColorPref  = 'Black' | 'White' | 'Navy' | 'Beige' | 'Earth Tones' | 'Colorful' | 'No Color Preference';
type Slot       = 'top' | 'layer' | 'bottom' | 'shoes' | 'accessory';

interface Product {
  id: string; name: string; retailer: string; slot: Slot;
  price: number | null;                 // null = "Price Unavailable" in Sprint 2
  productUrl: string | null;            // null = no shop link in Sprint 2
  priceRetrievedAt: string | null;
  colors: string[]; styles: StylePref[];
  image: string;
  arSupported: boolean; overlayAsset: string | null;
}

interface Outfit {
  id: string; name: string;
  occasions: Occasion[]; dressCodes: DressCode[];
  styles: StylePref[]; colors: string[];
  itemIds: string[]; heroImage: string;
}
```

**Catalog seed requirements** (`src/data/catalog.json`)

- 20 products; ≥5 tops/jackets flagged `arSupported: true` with `overlayAsset` paths reserved (PNGs land in Sprint 2)
- 12 pre-assembled outfits; every `Occasion × DressCode` reachable; coverage from $80 to $500+
- Each outfit is complete: top + bottom + shoes (+ layer where applicable)
- Edge cases required for Sprint 2 demo: exactly one product with `price: null` and one with `productUrl: null`
- ≥90% of `productUrl` values must be verified working retailer pages — log each check in [`docs/product-link-audit.md`](docs/product-link-audit.md) during catalog creation, since this is a charter success criterion (90% correct links)
- Every outfit used by a test scenario must be explainable: its `occasions`/`dressCodes` are what the reason string cites

---

## 7. Recommendation engine spec

Entry point: `recommendOutfits(prefs, catalog, { limit = 6 })` in [`src/engine/recommend.ts`](src/engine/recommend.ts) → `{ outfits: RankedOutfit[]; diagnostics: { occasion: number; dressCode: number; budget: number; style: number; color: number } }`.

**Hard filters, in order, each retaining a count for diagnostics**

1. `outfit.occasions.includes(occasion)`
2. `outfit.dressCodes.includes(dressCode)`
3. `knownTotal <= budget` — items with `price: null` are excluded from the sum and the outfit is marked `priceComplete: false` (AC 14.4 "where price information is available")
4. at least one style overlap
5. if color ≠ `No Color Preference`, at least one color overlap

**Scoring (deterministic, no randomness)**

| Signal | Points |
|---|---|
| Occasion exact | +30 |
| Dress code exact | +20 |
| Style overlap | +10 each, cap 30 |
| Color overlap | +8 each, cap 16 |
| Budget headroom (total ≤ 70% of budget) | +15 |
| Complete price data | +5 |

Sort by score descending; tie-break on a stable hash of `outfit.id` so results never reshuffle between renders. `limit` selections pass through a diversity filter (no two results may share the same `top` product) so cards look genuinely distinct (AC 8.3).

**Reasons** — each result carries 1–3 short strings rendered on the card, e.g. "Matches Work", "Business Formal", "$186 of your $250 budget". These double as demo narration and as test assertions.

**Empty state + relax** ([`src/engine/relax.ts`](src/engine/relax.ts)): when results are empty, compute up to three concrete alternatives with live counts, ordered by cheapest change:

1. Raise budget to the cheapest matching outfit total
2. Ignore color preference
3. Shift dress code to the adjacent formality level

Each renders as a button stating the exact outcome ("Show 2 outfits with your budget raised to $310"), satisfying AC 8.4 and Story 9 AC4 without a dead end.

---

## 8. Validation rules

| Field | Accepts | Rejects with message |
|---|---|---|
| Occasion | one of 4 | "Pick an occasion so we can style for the right event." |
| Dress code | one of 5 | "Choose a dress code — it sets the formality of your outfits." |
| Styles | ≥1 of 5 | "Choose at least one style you like." |
| Colors | ≥1 of 7, with `No Color Preference` mutually exclusive with concrete colors | "Pick a color, or choose No Color Preference." |
| Budget | digits with optional `$` and thousands separators, > 0, ≤ 100,000 | empty → "Enter your clothing budget in US dollars." · non-numeric → "Use numbers only, like 250." · zero → "Budget must be greater than $0." · negative → "Budget can't be negative." · huge → "That's higher than expected — try a value under $100,000." |

Inputs use `inputMode="decimal"`, `aria-invalid`, `aria-describedby`, and `role="alert"` on messages; errors appear on blur and on submit attempt, never while the user is mid-typing the first character.

---

## 9. Conversational mode (D3)

[`src/features/chat/parseIntent.ts`](src/features/chat/parseIntent.ts) — pure function, no network:

```ts
parseChatMessage(text: string, current: UserPreferences):
  { patch: Partial<UserPreferences>; reply: string; understood: boolean; appliedFields: string[] }
```

- Occasion: wedding / party / work / office / casual / weekend / date
- Dress code: black tie, cocktail, business formal, smart casual, casual
- Budget: `$250`, `under 250`, `250 dollars`, `max 300`, `budget of 180`
- Style: minimalist / classic / trendy / streetwear / bohemian
- Color: black / white / navy / beige / earth tones / neutral / colorful
- Follow-up "cheaper" / "less expensive" → `budget = knownTotal × 0.8` of the current best result
- Unrecognised input → no patch, return a clarifying reply listing what it can change and prompting for the missing field (mirrors the charter risk mitigation "ask clarifying questions when details are missing")

The bar renders above the preference sections so a single sentence can populate all four states, then shows a transcript line confirming exactly which fields changed — that confirmation is what makes the "chat updates preferences" claim demonstrable rather than hidden magic.

---

## 10. Repository layout

```
VibeFit/
├── app/
│   ├── index.html
│   ├── package.json · vite.config.ts · tsconfig.json · tailwind.config.ts
│   └── src/
│       ├── main.tsx · App.tsx · routes.tsx · index.css
│       ├── types/domain.ts
│       ├── data/catalog.json · catalog.schema.ts · testScenarios.ts
│       ├── store/preferencesStore.ts
│       ├── engine/recommend.ts · score.ts · relax.ts · __tests__/
│       ├── features/
│       │   ├── preferences/  PreferencesPage.tsx · OccasionSelector.tsx · DressCodeSelector.tsx
│       │   │                 BudgetInput.tsx · StyleColorSelector.tsx · validation.ts
│       │   ├── chat/         ChatBar.tsx · parseIntent.ts · __tests__/
│       │   └── results/      ResultsPage.tsx · OutfitCard.tsx · EmptyState.tsx
│       └── components/  Button · Card · Badge · Alert · StepIndicator · ErrorBoundary
├── docs/sprint-1-acceptance-matrix.md · demo-script.md · product-link-audit.md
└── plans/sprint-1-plan.md
```

Routes: `/preferences` (default) → `/results`, with a guard that redirects to `/preferences` when required inputs are missing, so a hard refresh never lands on a broken results page.

---

## 11. Test plan

Vitest + Testing Library + jsdom. Scripts: `npm test`, `npm run test:coverage`, `npm run typecheck`, `npm run build`.

**Charter 10 scenarios** in [`src/data/testScenarios.ts`](src/data/testScenarios.ts) — the suite asserts the charter's "8 of 10" bar explicitly and reports the pass count.

| # | Occasion | Dress code | Budget | Styles | Colors | Expected |
|---|---|---|---|---|---|---|
| 1 | Casual Outing | Casual | $120 | Minimalist | Beige | ≥2 outfits, all ≤ $120 |
| 2 | Work | Business Formal | $400 | Classic | Navy | ≥2 outfits |
| 3 | Party | Cocktail | $250 | Trendy | Black | ≥2 outfits |
| 4 | Wedding | Black Tie | $500 | Classic | Black | ≥2 outfits |
| 5 | Work | Business Formal | $80 | Streetwear | Colorful | **empty state + relax actions** |
| 6 | Wedding | Cocktail | $250 | Bohemian | No Color Preference | ≥2 outfits |
| 7 | Casual Outing | Smart Casual | $150 | Streetwear | No Color Preference | ≥2 outfits |
| 8 | Party | Casual | $200 | Bohemian | Earth Tones | ≥1 outfit |
| 9 | Work | Smart Casual | $300 | Minimalist | Beige | ≥3 outfits |
| 10 | Casual Outing | Casual | $90 | Trendy | White | ≥1 outfit |

Each assertion checks: unique ids, complete item sets, total ≤ budget, non-empty reasons. Scenario 5 is the deliberate negative case for AC 8.4 / 9.4.

**Additional suites:** budget validation table (~12 cases), style/color mutual exclusivity, persistence across simulated refresh, Edit Preferences round trip preserving untouched fields, chat parser (~15 utterances incl. "Show me a cheaper option"), and a guard test that no product with `price: null` is counted into a budget total.

---

## 12. Risks for this sprint

| Risk | Impact | Mitigation |
|---|---|---|
| Sprint end date passed with 0 items Done | Spin look poor at review | Re-baseline Sprint 1 to 11/19, log the slip, keep Sprint 2 start fixed |
| Three stories already "In Progress" with no code in the repo | Duplicate or conflicting work | Confirm ownership (D4) before scaffolding; one repo, one branch strategy |
| 16 points of committed scope plus a charter-mandated chat bar | Sprint overrun | Chat bar is a thin deterministic parser, not an LLM integration; if time is short, ship it read-only against the preference form |
| Catalog link validity at 90% | Charter success criterion | Audit links during catalog creation, record in [`docs/product-link-audit.md`](docs/product-link-audit.md) |
| Price drift in sample data | Demo credibility | Store `priceRetrievedAt`; Sprint 2 surfaces the "Sample Price" badge |
| Empty-state reachable too easily in demo | Looks broken to sponsor | Scenario 5 is the only intentional empty case; relax buttons always produce a path forward |

---

## 13. Definition of Done for Sprint 1

1. All 20 Sprint 1 acceptance criteria have a passing test or a documented manual verification step in the acceptance matrix.
2. `npm run typecheck && npm test && npm run build` pass clean.
3. All four preferences survive a page refresh and an Edit Preferences round trip.
4. The 10 scenario suite reports ≥8/10 meeting occasion, dress code, and budget.
5. Empty state and its relax buttons are reachable and demonstrate a recovery path.
6. Chat bar updates all four preference states from one sentence and confirms what it changed.
7. 5-minute demo script runs end-to-end with no console errors.
8. Jira: VIBE-11, VIBE-13, VIBE-14, VIBE-15, VIBE-8 transitioned to Done with a link to the acceptance matrix.
