# Sprint 3 handoff

This follow-on to Sprint 2 covers department and retailer preferences, result-card imagery, automatic try-on alignment, and product-link verification.

Neutral Layers has verified retailer pages and matching photos for every piece.
Generate with Womenswear, Work, Smart Casual, and a $300 budget. The navy
sweater has a 2D photo overlay. Physical-camera alignment remains an acceptance
check.

| Area | Implemented behavior | Verification |
| --- | --- | --- |
| Department | Optional department selection narrows recommendations and persists across navigation. | Department and retailer tests, store migration tests, and Sprint 3 UI tests |
| Retailer | Users can select catalog retailers and relax the filter when it yields no matches. | Department and retailer tests and Sprint 3 UI tests |
| Result imagery | Result cards show a hero and per-piece visuals, with an illustrative fallback when imagery is missing. | Sprint 3 UI tests |
| Try-on | Live video estimates shoulder position and span. After three confident samples, the overlay follows the mirrored, cropped preview. Manual alignment pauses tracking until resumed. Loss of confidence holds the overlay in place. Camera denial and user choice use silhouette mode. | Frame-estimator, tracking-hook, and preview tests. Physical-camera calibration remains open. |
| Product links | Both audit tools detect soft blocks and missing pages. Product metadata identifies candidates for manual verification. The G.H. Bass URL recorded as a 404 now uses the unavailable-link state. | See the [product link audit](../docs/product-link-audit.md) for remaining verification. |

Run the following from `app/` before handoff.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

For camera acceptance, open the AR preview on localhost or HTTPS, grant permission, and verify that the overlay follows left and right movement in a portrait stage. Adjust a slider and move again to confirm that the overlay holds its manual position. Resume tracking, move out of frame, and confirm that the overlay holds position while the indicator searches. Switch to silhouette mode and verify that the camera stops and the manual controls remain available.
