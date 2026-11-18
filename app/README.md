# VibeFit — App

React + TypeScript + Vite prototype for the MSIS-609 VibeFit project.

## Commands

```bash
npm install        # once
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build      # typecheck + production bundle
```

## Structure

```
src/
├── styles/      design tokens and global CSS (Editorial Obsidian & Champagne)
├── lib/         cn(), money formatting, motion vocabulary
├── types/       domain unions and interfaces
├── data/        catalog seed + Zod schema + charter test scenarios
├── store/       persisted preference store (Zustand)
├── engine/      recommendation filters, scoring, relax strategies
├── features/    preferences · chat · results
└── components/  ui primitives and layout shell
```

Design and motion rules live in [`../plans/sprint-1-plan.md`](../plans/sprint-1-plan.md).
