# VibeFit Design Tokens — Editorial Obsidian & Champagne

Reference for the visual system in [`app/src/styles/tokens.ts`](../app/src/styles/tokens.ts),
[`app/src/styles/theme.css`](../app/src/styles/theme.css), and
[`app/tailwind.config.ts`](../app/tailwind.config.ts).

The palette lives in **one file**. Tailwind maps it to utilities; components never
hardcode hex values (enforced by review, and by the fact that only `tokens.ts`
exports color).

---

## Palette

| Token | Value | Role |
|---|---|---|
| `obsidian` | `#09090B` | Base canvas. Deliberately not pure black — pure black on OLED makes glass edges disappear. |
| `obsidianElevated` | `#111113` | Denser surfaces where a panel must sit above the canvas without glass |
| `champagne` | `#E5C158` | Primary accent: actions, selected borders, match ring, focus |
| `champagneSoft` | `#EFDC97` | Hover state for champagne fills |
| `champagneDeep` | `#C9A63F` | Pressed / active champagne |
| `violet` | `#A855F7` | AI assistant accent: sparkles, chat dock, `AR Ready` badge |
| `comfortable` | `#34D399` | Budget comfortably within limit |
| `tight` | `#FBBF24` | Budget close to the limit |
| `over` | `#FB7185` | Over budget / validation error |
| `textPrimary` | `#FAFAFA` | Body and headings |
| `textSecondary` | `#A1A1AA` | Supporting copy |
| `textTertiary` | `#71717A` | Auxiliary labels only — **not** body text (below 4.5:1) |

### Ambient mesh

| Token | Value | Notes |
|---|---|---|
| `meshChampagne` | `rgba(212, 175, 55, 0.08)` | Static radial, top-left |
| `meshViolet` | `rgba(139, 92, 246, 0.07)` | Static radial, top-right |

Both are fixed CSS gradients, never animated and never canvas. A decorative layer
must not consume frame budget during the result-card stagger.

---

## Surfaces

| Utility | Definition | Use |
|---|---|---|
| `surface-glass` / `Surface` default | `bg-white/[0.03] backdrop-blur-xl border border-white/10` | Every card, panel, dock |
| `surface-glass-hover` / `elevated` | `bg-white/[0.05] border-white/[0.14]` | Hover, open, emphasised states |
| `edge-highlight` | inset top hairline + large soft shadow | Reads as light catching a glass edge |

Radii: surfaces `1rem`, tiles `0.875rem`, pills `999px`.

---

## Typography

Three roles, three fonts, one job each. Mixing them is the main way this design
system can go wrong.

| Role | Family | Used for |
|---|---|---|
| Display | **Instrument Serif** (fallback Cormorant Garamond, then Georgia) | Page titles, outfit names, section headings, empty-state headline |
| UI | **Plus Jakarta Sans** | Labels, buttons, chips, body copy, validation messages |
| Data | **JetBrains Mono** | USD amounts, budget percentages, match scores, step numbers, story keys |

Loaded once in [`index.html`](../app/index.html) with `display=swap` and `preconnect`.
`display=swap` is load-bearing: on a cold network the demo must show readable text on
first paint rather than invisible text for a second.

### Scale

| Token | Size |
|---|---|
| `display.xl` / `lg` / `md` | 3.5rem / 3rem / 2.5rem |
| `heading.md` / `sm` | 1.75rem / 1.5rem |
| body | 0.9375rem (15px) |
| label | 0.8125rem (13px), `uppercase`, `tracking-[0.08em]` |
| mono | 0.8125rem (13px), `tabular-nums` |

Italic Instrument Serif is reserved for the empty-state headline. It is the one place a
constraint conflict should feel *authored* rather than like an error dialog.

---

## Contrast (guarded by `tokens.test.ts`)

| Combination | Ratio | Minimum |
|---|---|---|
| Obsidian text on champagne fill | > 4.5:1 | 4.5 |
| White on obsidian canvas | > 7:1 | 7 |
| Secondary on obsidian | > 4.5:1 | 4.5 |
| Rose / emerald / amber / violet on obsidian | > 4.5:1 | 4.5 |
| Tertiary on obsidian | ~3–4.5:1 | 3 (auxiliary only) |

**Rule:** gold is a *fill* with obsidian text on it, never small gold body text on
glass. If you need small gold text, use `champagneSoft` on a dark surface and check it.

---

## Motion

All presets live in [`app/src/lib/motion.ts`](../app/src/lib/motion.ts). Durations are
adjustable in one place.

| Preset | Value |
|---|---|
| `pageTransition` | opacity 0→1, y 8→0, 240ms, `[0.22, 1, 0.36, 1]` |
| `staggerContainer` | `staggerChildren: 0.08`, `delayChildren: 0.04` |
| `cardReveal` | opacity 0→1, y 12→0, 320ms |
| `patchPop` | scale 0.9→1, opacity 0→1, 180ms |
| `shake` | x `[0, -6, 6, -3, 0]`, 220ms |

### The three hard rules

1. **Motion never owns behaviour.** Every preset collapses to `{ duration: 0 }` when
   `prefers-reduced-motion` is set, and is forced off entirely under Vitest via
   `MOTION_DISABLED`. `motion.test.ts` asserts this, so a future refactor cannot quietly
   reintroduce timing-dependent tests.
2. **Content mounts immediately.** Cards exist in the DOM at full opacity on first
   render in test and reduced-motion environments. Only `transform` and `opacity`
   animate, never layout, never `height`.
3. **State lives in ARIA, not in animation.** Selection is `aria-pressed`; errors are
   `aria-invalid` + `role="alert"`; the progress step is `aria-current="step"`. The
   shared-`layoutId` rings are purely decorative.

### Never do this

- Do not wrap a whole card in a `<button>` to get a click target. It invalidates the
  heading and list model for assistive tech. Use an overlay button
  (see [`OutfitCard.tsx`](../app/src/features/results/OutfitCard.tsx)).
- Do not re-key a component to restart an animation. It unmounts the subtree and
  destroys focus and caret position — this exact bug shipped into the budget field
  during development and was caught by a test.
- Do not animate `backdrop-filter`, `box-shadow`, or `width`.
