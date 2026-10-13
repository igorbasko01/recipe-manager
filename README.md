# Recipes

A personal, offline-first recipe manager. Single-user, installed to your phone's
home screen, works with no network. Everything lives on-device — no accounts, no
server, no sync.

## Running it

```bash
npm install
npm run dev
```

The service worker only runs in a production build, so to check that it really
works offline:

```bash
npm run build && npm run preview
```

Then open the preview URL, install it from the browser menu ("Add to Home
Screen" / "Install app"), and switch off the network.

## What it does

**Recipes.** Ingredients are rows of `{amount, unit, name, note}`. The amount is
numeric and nullable, so "salt, to taste" is a row with no amount. Fractions are
parsed as you type — `1/2`, `1 1/2` and `½` all work — and displayed back as
fractions rather than decimals. The unit is free text, backed by a datalist of
every unit you have already used. Instructions are a numbered list of steps.

**Search.** Fuzzy and prefix matching across titles, ingredient names and
steps, with titles weighted highest. The index is built in memory at
startup and updated as you save, so results appear as you type.

**Editing.** The form writes straight to IndexedDB. Ingredient rows and steps can
be added, removed and reordered individually. The edit in progress is autosaved as
a draft, debounced while you type and flushed the moment the tab is hidden, so a
backgrounded tab loses nothing — reopen the editor and your changes are there.

**History.** Every save writes a full snapshot of the previous state, keyed by
recipe and timestamp. Each recipe has a version list; any version can be
expanded to read it, and reverted to in one click. A revert is itself a save, so
it too can be undone. Nothing is pruned.

**Backup.** Export everything — recipes and their full version history — as a
JSON file, and import it back. Importing merges: a recipe with the same id is
replaced by the imported copy.

## Storage

Recipes, versions and drafts live in IndexedDB via Dexie. On first run the app
calls `navigator.storage.persist()` to ask the browser not to evict them. The
app shell is precached by the service worker, so it opens and runs with no
network at all.

Because there is no sync, the export is your only backup. Take one occasionally.

## Deploying

The app is a static build with no backend, so any static host works. It is
deployed to Cloudflare Pages at https://recipes.baskorp.com.

Pages project settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 |

`public/_headers` ships the caching rules Pages needs. They matter: the build
registers the service worker with `autoUpdate`, so the browser finds a new
release by re-fetching `sw.js`. If the CDN caches that file, every visitor stays
pinned to the build they first loaded. Hashed files under `assets/` are cached
forever instead, since their contents can never change.

`base` is `'./'`, so the same build also works from a subdirectory
(`vite build --base=/recipes/`) if it ever moves under another site.

### A note on moving it

IndexedDB is scoped to an origin. Serving the app from a different host — or
from a path on a different host — gives it an empty database; the recipes stay
behind at the old origin. If the URL ever has to change, export a backup first
and import it on the other side.

## Stack

Vite · React · TypeScript · Dexie (IndexedDB) · MiniSearch · vite-plugin-pwa
(Workbox) · Vitest + Testing Library

## Tests

```bash
npm test
```

115 tests covering fraction parsing, the repository's version-on-every-save
rule, search ranking, backup round-trips, draft autosave timing, and the full UI
flow driven through real clicks and keystrokes. Persistence is tested against
`fake-indexeddb`, not mocks.

## Not included, on purpose

Auth, sync, input validation, settings, onboarding, multi-user anything.
