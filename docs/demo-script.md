# VibeFit Sprint 1 — 5-Minute Demo Script

For the sprint review and as a rehearsal for the 12/08 sponsor demo.
Timings are guidance, not rules. Run `cd app && npm run dev` first.

---

## Before you start

- [ ] `npm run dev` running, browser open at `http://localhost:5173`
- [ ] DevTools console open and visible — you will point at it being empty
- [ ] One incognito window ready for the "fresh user" moment
- [ ] Have scenario 5 numbers to hand: **Work · Business Formal · $80 · Streetwear · Colorful**

---

## 0:00 — Frame the problem (30s)

> "VibeFit answers one question: *what should I wear to this event, and can I afford it?*
> Today I'm showing Sprint 1 — the preference flow, the recommendation engine, and the
> conversational assistant the charter committed us to for 11/17."

Note out loud that the board shows 10 points but the committed items sum to 16, and
that the sprint end date was re-baselined by one day. Say it before a reviewer finds
it.

## 0:30 — Conversational entry (45s)

*This is the charter milestone. Show it first, while the page is fresh.*

1. Type into the chat dock: **"What should I wear to a summer wedding under $250?"**
2. Point at the result: occasion → Wedding, budget → $250, populated in one pass.
3. Point at the **patch pills** under the reply — these name the exact fields that
   changed. This is the difference between a demo that looks clever and one that is
   trustworthy.
4. Follow up with **"make it cheaper"** → budget drops to $200, everything else stays.

> "It parsed on-device. No API key, no network, no failure mode in this room — and
> because it's deterministic, the 24 tests on it are real assertions, not smoke tests."

## 1:15 — Preferences (60s)

1. **Occasion** — select *Wedding*. Note the ring travels to the tile rather than
   blinking: one object changing state.
2. **Dress code** — click along the formality ladder from *Casual* to *Black Tie*.
   "The dot slides along one rail, so you can see formality is a spectrum. Changing
   your dress code is a visible action, not just a saved value."
3. **Budget** — type `abc`. Blur the field. The message appears: *"Use numbers only,
   like 250."*
   > "We deliberately do **not** strip letters as you type. If we did, this acceptance
   > criterion could never actually be demonstrated — you'd watch your input vanish
   > with no explanation."
4. Type `0` → *"Budget must be greater than $0."* Type `-50` → *"Budget can't be
   negative."*
5. Now type `400`. The validation message clears immediately — no stale scolding.
6. **Style & colour** — pick *Classic*, then *Black*, then click *No Color Preference*.
   Point out that selecting the opt-out displaces the swatch, and selecting a swatch
   again displaces the opt-out. State the rule: they are mutually exclusive because
   they are different answers, not two more options.

## 2:15 — Generate (45s)

1. Click **Generate outfits**.
2. Point at the **match ring** (0–100), the **budget meter** (`$Total / $Budget` with a
   semantic colour), and the reason chips (*"Styled for Wedding"*, *"Black Tie"*,
   *"$… of your $400 budget"*).
3. Point at the **AR Ready** badge and be precise about it:
   > "That badge is data-driven — it means this outfit contains one of our five
   > AR-capable garments. In Sprint 1 it signals readiness. The camera try-on itself
   > is Sprint 2, per the charter."
4. Open a card. Sprint 1 has no detail view yet, so **skip clicking into it** unless
   asked, and say plainly: "Detail view, prices, and shop links are Sprint 2."

## 3:00 — Retention (30s)

1. Click **Edit preferences**.
2. Every choice is still there: Wedding, Black Tie, $400, Classic, Black.
3. Point at this specifically:
   > "This is Story 9 AC2 and Story 15 AC3. It works because every mutation is a
   > partial patch against one persisted store. No screen keeps a local copy, so
   > returning to edit can't wipe your other answers."

Optionally: hard-refresh the browser. Everything survives, because the store persists.

## 3:30 — The empty state (60s)

*This is the strongest part of the demo. Slow down.*

1. Change to **Work · Business Formal · $80 · Streetwear · Colorful**.
2. Click **Generate outfits**.
3. Show what appears: an italic headline — *"Nothing in the collection fits every
   constraint"* — and a line naming the constraint doing most of the damage.
4. Point at the three **relax tiles**, and read one aloud: *"Show 2 outfits with your
   budget raised to $310."*
   > "Each tile states its exact outcome, computed against the real engine. It is not
   > 'try relaxing your filters' — that gives you nothing to decide with."
5. Click one. Results appear.

> "This is the acceptance criterion everyone fails: *if no outfit matches, show a clear
> message instead of an empty or broken screen.* A message alone still strands the
> user, so we shipped recovery paths. And note the escalation — dropping style alone
> isn't enough here, dropping colour alone isn't enough, and $80 can't cover Business
> Formal tailoring. Our first version showed **zero** buttons for this case. That's
> the exact dead end the criterion forbids, and the test suite caught it."

6. Confirm the console is clean.

## 4:30 — Close on the numbers (30s)

> "All 10 charter scenarios pass; the charter asks for 8. 115 tests green, typecheck
> clean, production build clean. Every one of the 20 Sprint 1 acceptance criteria is
> mapped to a file and a test in the acceptance matrix — that's the document to check
> my claims against rather than taking my word for it."

Then hand over the matrix: [`sprint-1-acceptance-matrix.md`](sprint-1-acceptance-matrix.md).

---

## Q&A prep — likely questions

**"Is this actually AI?"**
> "The recommendation engine is a hybrid: deterministic filters and weighted scoring
> over a curated catalog, plus a rules-based language parser. That was a deliberate
> choice — it's testable and it can't fail on stage. The assistant's function signature
> is the seam where a model drops in for Sprint 2 without touching the UI."

**"Why only $80 to $500 of catalog?"**
> "21 products, 21 outfits, covering every occasion × dress code pair. One item
> deliberately has no price and one has no product URL, so the Sprint 2 criteria for
> *Price Unavailable* and *missing shop link* can be demonstrated rather than claimed."

**"What about the camera?"**
> "Sprint 2, per the charter's 11/24 milestone. Five garments are already flagged
> `arSupported` with overlay asset paths reserved, and the result cards already surface
> AR readiness, so the integration is additive."

**"What isn't done?"**
> "Outfit detail, itemised prices, shop links, and AR. All four are Sprint 2, and the
> catalog already carries the data they need. I'd rather say that plainly than show you
> a badge for a feature that doesn't exist."

---

## Failure fallbacks

| If this breaks | Do this |
|---|---|
| Fonts don't load | Nothing to fix live — `display=swap` means text renders in a fallback serif. Keep going. |
| Camera permission prompts never appear | Expected: no camera in Sprint 1. Say so. |
| Results look empty | You are probably on scenario 5. Lead with the empty state — it's the better story anyway. |
| A render error appears | The error boundary shows *"Something went sideways"* with a *Start again* button. Say "this is the guard against exactly this moment" and click it. |
| Console shows a warning | Do not read it aloud. Note it and follow up after. |
