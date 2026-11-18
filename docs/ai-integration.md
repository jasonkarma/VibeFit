# Live AI Integration — LumiaRouter + `claude-opus-5-5`

Sprint 2 adds a live styling model on top of Sprint 1's deterministic engine. The
local engine is **not** replaced — it is the permanent fallback, and the app is
fully functional with no key at all.

---

## 1. Architecture

```
Browser ──► /api/lumia/chat/completions ──► Vite dev proxy ──► lumiarouter.com/v1
                (same-origin, no CORS)         (optional key injection)
```

The browser never talks to `lumiarouter.com` directly. It calls a same-origin path
(`/api/lumia/...`) that the Vite dev server forwards upstream. That solves the
localhost CORS problem and creates one place where credentials can be handled.

### Files

| File | Role |
|---|---|
| [`app/.env.example`](../app/.env.example) | Template with the three `VITE_AI_*` vars and a security note |
| [`app/.env.local`](../app/.env.local) | Your real key. **Gitignored.** |
| [`app/vite.config.ts`](../app/vite.config.ts) | `/api/lumia` proxy + dev-only `/api/lumia/health` |
| [`app/src/prompts/stylistPrompt.ts`](../app/src/prompts/stylistPrompt.ts) | System/user prompts, closed vocabularies, JSON contract |
| [`app/src/services/aiStylist.ts`](../app/src/services/aiStylist.ts) | Transport, response validation, fallback logic |
| [`app/src/features/chat/ChatDock.tsx`](../app/src/features/chat/ChatDock.tsx) | AI-first parsing, fallback, status badge |
| [`app/src/features/results/ResultsPage.tsx`](../app/src/features/results/ResultsPage.tsx) | Triggers ranking once per generation |

---

## 2. Setup

```bash
cd app
cp .env.example .env.local
# paste your key into .env.local
npm run dev
```

Vite only reads env at startup — **restart the dev server after editing `.env.local`.**

### Two ways to supply the key

| Mode | Variable | Where the key lives | Use for |
|---|---|---|---|
| Simple | `VITE_AI_API_KEY` | Compiled into the JS bundle | Local demo on your own machine |
| Recommended | `LUMIA_API_KEY` | Dev server only, injected as a header | Anything you deploy |

**Read this before choosing:** every `VITE_`-prefixed variable is embedded in the
client bundle. Anyone who opens devtools can read it, and a LumiaRouter key is
billable. The proxy supports `LUMIA_API_KEY` (no prefix) specifically so the key can
stay server-side. If both are set, the server-side key wins and the browser sends
no credentials at all.

`.env` and `.env.*.local` are covered by [`.gitignore`](../.gitignore), verified with
`git check-ignore -v app/.env.local`.

---

## 3. How the model is used, and how it is contained

### Two modes

**Parse** — natural language → preference patch.
`"summer wedding under 250"` → `occasion: "Wedding"`, `budget: 250`. Follow-ups
resolve against current state, so `"make it cheaper"` reduces the existing budget
rather than guessing. If the user has not stated an occasion or a budget, the
prompt requires a clarifying question instead of an invented value.

**Rank** — order and explain the engine's candidates.
The model receives only outfits that already passed every hard filter, and returns
IDs with a one-sentence reason each.

### Why ranking, not generating

The model never invents an outfit. By the time it sees anything, the deterministic
engine has already enforced occasion, dress code, budget, style, and colour. The
model's only job is ordering and prose. This inverts the usual failure mode of LLM
recommenders: instead of hoping it respects a $250 budget, the budget is already
enforced in code and the model can only choose from what survived.

### Four hard guards

Prompt instructions are not a security boundary, so each is enforced in code:

1. **Vocabulary.** Occasion, dress code, style, and colour are checked against the
   closed enums in `types/domain.ts`. An unknown value is dropped, not coerced.
2. **Outfit IDs.** `interpretRankResponse` accepts only IDs present in the current
   candidate set. A hallucinated outfit is silently discarded — the model cannot
   create a card.
3. **Budget.** Model-supplied budgets go through the same `validateBudget` as the
   form, so `0`, negatives, and junk are rejected identically on both paths.
4. **Prices in prose.** `sanitiseReason` strips `$186`, `1,249.50`, `250 dollars`,
   and `USD 300` patterns from every reason. The app displays real prices itself; a
   fabricated figure next to a real one is the most damaging possible output.

Colour exclusivity (`No Color Preference` never coexists with concrete colours) is
enforced at three levels: prompt, service, and store.

---

## 4. Fallback behaviour

The live model is attempted only when **all** of these hold: not in Vitest, not
already degraded, and a key is present. Otherwise the local engine answers.

| Condition | Behaviour |
|---|---|
| `VITE_AI_API_KEY` empty | Local engine, badge reads **Local Engine** |
| Inside Vitest | Local engine, fetch never called |
| Network error / timeout (20s) | Local engine, session marks degraded |
| Non-2xx response (bad key, unknown model) | Local engine, session marks degraded |
| Response is not JSON, or fails Zod | Local engine for that message |
| Ranking returns only unknown IDs | No AI reasons; engine chips remain |

"Degraded" is sticky for the session. A badge that flickers between Live and Local
is worse than one that honestly settles on Local once the network has proven
unreliable.

**The badge reports what actually happened, not what was configured.** It reads
**Opus 5.5 Live** only when at least one validated reason came back from the model.
A badge claiming "Live" while the local parser did the work would be a lie in the
one place the user is asked to trust the system.

---

## 5. Verification performed

| Check | Result |
|---|---|
| `npm test` | **159 passing** (9 files, +44 on Sprint 1's 115) |
| `npm run typecheck` | clean |
| `npm run build` | clean, 1.26s |
| `GET /api/lumia/health` | `{"configured":false,"keyLocation":"none","model":"claude-opus-5-5"}` — reports config, **never the key** |
| `POST /api/lumia/chat/completions` with no key | `HTTP 401` from upstream — proves the proxy forwards correctly |
| `app/.env.local` in git | `git check-ignore` confirms ignored; absent from `git status` |

New tests cover: hallucinated outfit IDs rejected, unknown vocabulary dropped,
contradictory colour pairs normalised, non-positive budgets rejected, fenced and
prose-wrapped JSON recovered, malformed entries tolerated without losing the batch,
price patterns stripped, and fallback triggered when unconfigured or throwing.

### Not verified

**No live call has been made with a real key.** All AI-path tests exercise the
validation and fallback logic directly; the network path was confirmed only as far
as the upstream 401. Once you add a key, run one message and one generation to
confirm the end-to-end round trip, and expect the badge to read "Opus 5.5 Live".

---

## 6. Limitations and next steps

- **The key is in the browser when using `VITE_AI_API_KEY`.** Acceptable for a
  classroom demo; use `LUMIA_API_KEY` otherwise. A production build would move
  this behind a real backend, not a dev proxy.
- **Ranking runs once per generation**, keyed on `lastGeneratedAt`. Keying on the
  results array would re-fire on every render and bill duplicate calls.
- **No streaming.** A 20s timeout and a spinner is enough for a prototype; streaming
  would improve perceived latency noticeably if the model is slow.
- **No retry.** A single failure degrades for the session. A production
  implementation would retry once with jitter before degrading.
- **Reasons are capped at 6** and 160 characters, matching the UI limit.
