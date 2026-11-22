# VibeFit — App

React + TypeScript + Vite prototype for the MSIS-609 VibeFit project.

## Commands

```bash
npm install        # once
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # typecheck + production bundle
npm run audit:links # retailer URL check
```

**The AR try-on requires a secure context.** Use `http://localhost:5173` or HTTPS.
`getUserMedia` is unavailable on a plain-HTTP LAN address, and the preview falls back
to silhouette mode there.

## Routes

| Route | Purpose |
|---|---|
| `/preferences` | Four preference inputs, validation, chat dock (Sprint 1) |
| `/results` | Ranked outfit grid (Sprint 1) |
| `/results/:outfitId` | Outfit detail — itemised pricing, shop links, rationale (Sprint 2) |
| `/results/:outfitId/preview` | Combined-look preview and AR try-on (Sprint 2) |

## Structure

```
src/
├── styles/      design tokens and global CSS (Editorial Obsidian & Champagne)
├── lib/         cn(), money formatting, pricing rules, motion vocabulary
├── types/       domain unions and interfaces
├── data/        catalog seed + Zod schema + charter test scenarios
├── store/       persisted preference store (Zustand)
├── engine/      recommendation filters, scoring, relax strategies, outfit lookup
├── features/    preferences · chat · results · outfit · preview
└── components/  ui primitives and layout shell
public/ar/       five hand-authored SVG garment overlays
```

## Notes for Sprint 2

- **No invented prices.** A product with `price: null` renders `Price Unavailable` and
  is excluded from the outfit total. `src/lib/pricing.ts` returns a discriminated union
  so a partial total cannot be displayed as a complete one.
- **No dead links.** A product with `productUrl: null` renders `Link Unavailable` and
  no anchor element at all.
- **Camera is consent-gated.** `getUserMedia` is only reachable through the consent
  card. Video is never recorded, stored, or uploaded; tracks are stopped on unmount.
- **Assets are illustrative.** Garment visuals are generated placeholders, always
  labelled `Prototype Visual`. The AR overlays are hand-authored SVGs, not product
  photography.

Design and motion rules live in [`../plans/sprint-1-plan.md`](../plans/sprint-1-plan.md);
Sprint 2 architecture and decisions in
[`../plans/sprint-2-plan.md`](../plans/sprint-2-plan.md); acceptance evidence in
[`../docs/sprint-2-acceptance-matrix.md`](../docs/sprint-2-acceptance-matrix.md).
