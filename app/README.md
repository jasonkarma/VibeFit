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
- **Shopping destinations.** An item-specific `productUrl` appears as **Check item**
  until `productUrlVerifiedAt` records a retailer match. Verified links display
  **View item**. A storefront or category `retailerUrl` appears as **Browse**.
  Items without either destination show **Link Unavailable**.
- **Camera is consent-gated.** `getUserMedia` is only reachable through the consent
  card. Video is never recorded, stored, or uploaded; tracks are stopped on unmount.
- **Catalog media.** Neutral Layers, Garden Formal, and Bomber Wedding have
  matching retailer photos for every piece. Items without photography use
  illustrations.

Design and motion rules live in [`../plans/sprint-1-plan.md`](../plans/sprint-1-plan.md);
Sprint 2 architecture and decisions in
[`../plans/sprint-2-plan.md`](../plans/sprint-2-plan.md); acceptance evidence in
[`../docs/sprint-2-acceptance-matrix.md`](../docs/sprint-2-acceptance-matrix.md).


## Sprint 3 follow-on

Department and retailer filters are optional. Result cards show a hero and item
visuals with illustrative fallbacks. In the live camera preview, automatic
shoulder tracking pauses when you adjust an alignment control. Choose **Resume
tracking** to let the overlay follow again. Silhouette mode supports manual
alignment without a camera.

See the [Sprint 3 handoff](../plans/sprint-3-plan.md) and
[product link audit](../docs/product-link-audit.md) for verification steps.

## Add product photos and 2D try-on assets

Verify that the retailer page, photo, and garment cutout show the same item and
colorway. Put the exact item page in `productUrl` and add an approved product
photo to `public/catalog/`. Set `image` to its app path, such as
`/catalog/item.webp`. The recommendations, outfit detail, and combined look all
use that photo.

For a supported top or jacket, export a front-facing, background-free PNG or
WebP on a 3:4 transparent canvas. Center the shoulders at about 28% of the canvas
height and use the existing SVG overlays as placement guides. Put the cutout in
`public/ar/`, set `photoOverlayAsset` to its app path, and enable `arSupported`.
An existing `overlayAsset` serves as the fallback. For an opaque photo, add a
`photoOverlayOutline` of garment boundary points in stage percentages. The masked
image is fitted to the stage and aligned to its bottom edge. Check alignment in
camera and silhouette modes. The live overlay preserves visible fabric details from the
photo and tracks shoulder position and scale. Fit, drape, and occlusion require
additional rendering and garment data.
