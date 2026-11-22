# VibeFit Sprint 2 — Demo Script

For the 11/24 milestone review and as a rehearsal for the 12/08 sponsor demo.
Replaces the Sprint 1 script for this review; [`demo-script.md`](demo-script.md) is
kept as the Sprint 1 record.

Run `cd app && npm run dev` first, and open `http://localhost:5173`.
**Use `localhost` or HTTPS.** `getUserMedia` requires a secure context; a plain-HTTP
LAN host will silently fail and the camera demo will not run.

---

## Before you start

- [ ] `npm run dev` running, browser open at `http://localhost:5173`
- [ ] DevTools **Network** tab open — you will point at it staying empty during the AR step
- [ ] Camera permission state known. To demo the *denial* path convincingly, have one
      browser profile where camera access is already blocked
- [ ] Scenario 5 numbers to hand: **Work · Business Formal · $80 · Streetwear · Colorful**
- [ ] Know the two edge-case outfits: **Boardroom Standard** (null URL) and
      **Neutral Layers** (null price)

---

## 0:00 — Where we are (30s)

> "Sprint 1 delivered the preference flow, the recommendation engine, and the
> conversational assistant. Sprint 2 delivers the other half of the promise: what
> happens *after* you pick an outfit. Details, real prices, a way to actually buy it,
> and the AR try-on the charter named for 11/24."

State the scope plainly: stories 6, 7, 8, 10 plus the charter AR requirement, 21
acceptance criteria, 240 tests.

## 0:30 — Generate (30s)

1. Occasion **Work** → dress code **Business Formal** → budget `400` → style
   **Classic** → colour **Navy**.
2. **Generate outfits.**

> "Six results, each with a match score, a budget meter, and reasons. Everything here
> is from Sprint 1 — but note the badge now reads **AR Try-On**, not *AR Ready*. That's
> the difference between advertising a feature and shipping one."

## 1:00 — Story 6: outfit detail (60s)

1. Click **Boardroom Standard**.
2. Point at the header: occasion, dress code, piece count, match ring.
3. Point at the **Why this outfit** panel and the provenance badge.
   > "Two different things are on this screen and we keep them separate. The chips are
   > the engine's deterministic reasons — always present, always true. Above them is
   > the model's narrative, and the badge says **Opus 5.5 Live** or **Local Engine**
   > so you always know which one you're reading. If the model didn't write it, the
   > badge doesn't claim it did."
4. Scroll the garment grid. Point at a **Prototype Visual** badge.
   > "We don't have product photography. Rather than a broken image or a stock photo
   > pretending to be the product, every visual says what it is."

## 2:00 — Story 7: itemised pricing (60s)

1. Point at the five item prices: `$59.00`, `$139.00`, `$89.00`, `$110.00`, `$68.00` —
   all in the mono face.
2. Point at the **Sample Price • Retrieved 2026-11-18** line under each.
   > "The charter's risk register says we must disclose when pricing was captured.
   > That's this line, not a footnote somewhere."
3. Point at **Total Outfit Price $465.00** and the verdict: *"$65.00 over your budget."*
4. Now open **Neutral Layers** (back → the Work results → Neutral Layers).
5. Point at the linen trousers: **Price Unavailable**, with **no dollar figure at all**,
   and the sidebar reading **Known subtotal $208.00** with the amber line.
   > "This is the criterion that's easy to fake. The tempting move is to treat an
   > unknown price as zero, or write '~$250'. Both invent a fact. So we exclude it,
   > we say the total is a lower bound, and we **withhold the budget verdict entirely**
   > — because we genuinely cannot tell you whether this outfit fits your budget."

## 3:00 — Story 8: shopping links (30s)

Back to **Boardroom Standard**.

1. Point at **Shop at ARKET**, **Shop at COS**, etc.
   > "Real anchors, `target="_blank"`, `rel="noopener noreferrer"` — tabnabbing is the
   > obvious way to get this wrong."
2. Scroll to the gold hoops: **Link Unavailable**, and no button.
   > "The seeded edge case. We don't render a greyed-out button, because a greyed-out
   > button still looks clickable. There is no anchor in the DOM here at all."

## 3:30 — Story 10: preview (45s)

1. Click **Preview & AR Try-On**.
2. **Combined look** tab: the whole outfit assembled, labelled **Illustrative Prototype
   Preview**, with the piece list and the total.
3. Point at the footer disclaimer:
   > *"Visual appearance preview only — does not guarantee exact sizing or fit."*
   > "That sentence appears in both tabs. It's the honest boundary of what this is."

## 4:15 — The AR try-on (60s) — the moment the milestone is about

1. Click the **AR try-on** tab.
2. **Stop.** Before anything else, point at the consent card.
   > "The camera has not been touched. `getUserMedia` has not been called. This is a
   > hard gate in the code, not a polite prompt — the only function that can open the
   > camera is the button below, and the test suite asserts we never call it earlier."
3. Read the privacy claim:
   > "Every frame is drawn locally by your browser. Nothing is recorded, stored or
   > uploaded — not to a server, not to our backend. And that isn't a promise, it's an
   > architectural fact: there is no `fetch` anywhere in this feature, and there's a
   > test that spies on `fetch` and fails if it's ever called."
4. Click **Enable camera**. Allow the browser prompt.
5. Drag **Scale**, **Horizontal**, **Vertical**, **Opacity**.
   > "These four controls are the honest centre of this feature. We are not measuring
   > your body — you're aligning a garment. Which is why the disclaimer exists."
6. Switch to a different jacket via **Try a different top or jacket** — point out the
   `In this outfit` markers and that all five supported garments are available.
7. In DevTools → Network, confirm **no request** fired during the whole AR flow.

## 5:15 — Graceful degradation (45s)

*Do this on the profile with camera blocked, or click "Use silhouette mode instead".*

1. Show the named message — *"Camera permission was declined…"* — then the silhouette.
2. Drag all four sliders. Everything still works.
   > "This is the difference between a demo that dies on a permission prompt in a
   > lecture hall and one that doesn't. Denied, no device, device busy, and a browser
   > with no camera API at all — four paths, all landing somewhere usable."
3. **Stop camera** (or navigate back) and point at the camera indicator light going out.

## 6:00 — Close (30s)

> "240 tests green, typecheck clean, production build clean. Every one of the 21 Sprint 2
> criteria is mapped to a file and a test in `sprint-2-acceptance-matrix.md` — check my
> claims against that document rather than taking my word for it. The Sprint 1 matrix is
> still accurate too; nothing regressed."

Then hand over [`sprint-2-acceptance-matrix.md`](sprint-2-acceptance-matrix.md).

---

## Q&A prep — likely questions

**"Is this real virtual try-on?"**
> "No, and we say so. Real try-on needs pose estimation over a live stream. This is a
> 2D overlay compositor: a transparent garment asset you position yourself. It answers
> 'does this silhouette suit me', not 'will this fit'. That's why the alignment sliders
> are the centre of the feature rather than a hidden extra, and why the sizing
> disclaimer is permanent. The transform is one value object, which is exactly the seam
> a pose model would write into later."

**"Where does the video go?"**
> "Nowhere. It never leaves the browser tab. There is no upload path in the code — no
> `fetch`, no form data, no canvas export, no recorder — and there's a test that spies
> on `fetch` and asserts it's never called across the whole AR flow. Tracks are stopped
> on 'Stop camera' and on unmount, so the device is released."

**"What if the reviewer's machine has no camera?"**
> "Silhouette mode. Same overlay, same four controls, neutral body outline instead of
> video. It's a first-class mode with its own button on the consent card, not an error
> screen."

**"What about the item with no price?"**
> "It's deliberately in the catalog. We exclude it from the total, label the total
> 'Known subtotal', and withhold the budget verdict entirely — because we can't tell
> you whether that outfit fits your budget, and pretending otherwise would be the one
> thing this prototype must never do."

**"What isn't done?"**
> "Pose estimation and body measurement, which is a research problem, not a sprint.
> Real-time price scraping — prices are curated sample data with a retrieval date
> shown on every line. Checkout. Auth."

---

## Failure fallbacks

| If this breaks | Do this |
|---|---|
| Camera prompt never appears | Check you're on `localhost`, not a LAN IP. `getUserMedia` needs a secure context. Fall back to silhouette mode and say so — it demonstrates the same feature. |
| Camera prompt appears but video is black | Another app holds the device. Click **Try camera again**, or switch to silhouette. |
| `/results/o-08` looks empty | Preferences were cleared. Re-run the 0:30 step. The route redirects rather than showing a blank page. |
| Fonts don't load | `display=swap` renders a fallback serif. Keep going. |
| Console shows a warning | Don't read it aloud. Note it and follow up. |
| A render error appears | The error boundary shows *"Something went sideways"* with a *Start again* button. Say "this is the guard against exactly this moment" and click it. |
