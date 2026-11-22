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
- **Catalog media.** All 57 products in the current catalog have matching
  retailer photos. Missing or failed image loads use illustrative fallbacks.

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


## Live tracking and a 3D try-on path

Camera try-on uses MediaPipe Pose Landmarker to track both shoulders, rotate and
scale one garment, and hide its overlay when the pose is lost. The model and
WebAssembly runtime load from the app. Frames stay in the browser.

The current garment layer is a flat product photo or an illustration. For a 3D
pilot, source one garment with a front and back texture, a rigged GLB, and a
known real-world size. A browser renderer can drive its rig with shoulder,
elbow, and torso landmarks. Add person segmentation or a depth mask to put hands
and arms in front. Check motion and occlusion with a real webcam before adding
another garment. Accurate fit and drape need garment measurements and material
properties. The combined look is the whole-outfit preview.

The bundled Pose Landmarker Lite model is the float16 version 1 from the
[MediaPipe model documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models).
Its SHA-256 is `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.

### 3D sweater pilot

Open **Soft Business** from Menswear, Work, Smart Casual with a budget of at
least $284. Open camera try-on, enable the camera, then select **Try 3D sweater**.
The WebGL renderer uses a reconstructed crewneck mesh with a knit texture
sampled from the retailer's photo. Shoulder, hip, elbow, and wrist landmarks
drive the torso and articulated sleeves. If body tracking or WebGL is
unavailable, use the 2D preview.

This pilot approximates geometry and appearance. It has no retailer-supplied
pattern, fabric simulation, or depth-based occlusion against the user's hands
and clothing. Camera frames stay in the browser. The combined look remains the
whole-outfit styling preview.
