# CLAUDE.md

Guidance for working in this repository.

## What this is

A personal, offline-first recipe manager, built as a Progressive Web App.
Single-user, installed to a phone's home screen, works with no network.
Everything lives on-device: no accounts, no server, no sync.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest, single run
npm run test:watch # Vitest, watch mode
npm run build      # tsc -b && vite build (emits dist/ with sw.js + manifest)
npm run preview    # serve the production build, the only way to exercise the SW
```

There is no lint step; `tsc` in strict mode is the static check, and it runs as
part of `npm run build`.

## Architecture

Data flows in one direction: **IndexedDB → repository → store → React**.

- `src/lib/db.ts` — Dexie schema. Three tables: `recipes`, `versions`
  (keyed `[recipeId+timestamp]`), `drafts`. Also `requestPersistence()`, called
  once at startup to ask the browser not to evict us.
- `src/lib/repository.ts` — all persistence. The important rule lives in
  `saveRecipe`: **every save after the first writes a full snapshot of the
  previous state** into `versions`. That is what makes history and revert work,
  and it is why nothing else should write to `db.recipes` directly.
- `src/lib/store.ts` — `RecipeStore`, the single source of truth at runtime.
  Holds every recipe in memory for instant render, owns the MiniSearch index,
  and notifies React through `useSyncExternalStore`. Mutations go through
  `store.save/remove/revert` so the index and the in-memory list stay in step.
- `src/lib/search.ts` — MiniSearch wrapper. Built at startup from the full
  recipe list, updated incrementally per save. Prefix + fuzzy, title boosted.
- `src/lib/amount.ts` — fraction parsing and formatting. Amounts are stored as
  nullable numbers but typed and displayed as fractions (`1 1/2`, not `1.5`).
- `src/lib/ingredients.ts` — pure add/remove/move/update helpers over an
  ingredient array. Generic over the row type so the editor can carry its own
  `amountText` alongside the parsed value.
- `src/lib/backup.ts` — JSON export/import, including version history.
- `src/ui/` — React. `App.tsx` is a small screen switch (list / view / edit /
  history / backup); there is no router.

## Conventions

- **Never write to Dexie outside `repository.ts`.** Saving elsewhere silently
  skips the version snapshot.
- **Never mutate a recipe in place.** The repository deep-copies on write, and
  the store replaces arrays rather than mutating them.
- Amounts are `number | null`; `null` means "no amount" (`salt, to taste`), not
  zero. Parse with `parseAmount`, display with `formatAmount`.
- The editor keeps the raw text the user typed (`amountText`) next to the parsed
  number, so a half-typed `1 1/` does not get clobbered mid-keystroke.
- Adding a field to `Recipe` means updating `isRecipe` in `backup.ts`, or
  imported files will be silently rejected.

## Testing

TDD: a failing test first, then the code. `npm test` must be green before a
commit. Tests live next to the code they cover.

- Pure logic (`amount`, `ingredients`) is tested directly.
- Persistence (`repository`, `backup`, `store`) runs against `fake-indexeddb`,
  loaded globally in `vitest.setup.ts`.
- `src/ui/App.test.tsx` drives the real component tree through
  `@testing-library/user-event` — clicking, typing, and asserting on what lands
  in IndexedDB. Prefer adding a case here over mocking a component.

Two environment gotchas, both already handled in `vitest.setup.ts` and the hook
tests; keep them in mind when writing new tests:

- **fake-indexeddb schedules on `setImmediate`.** A bare `vi.useFakeTimers()`
  fakes it too and deadlocks every database call. Use
  `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`.
- jsdom has no `Blob#text` and no `URL.createObjectURL`; both are polyfilled in
  the setup file for the export path.

## Deliberately out of scope

Auth, sync, input validation, settings, onboarding, multi-user. Version pruning
is left for later. Don't add these without being asked.
