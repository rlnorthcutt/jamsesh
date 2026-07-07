# CLAUDE.md

Guidance for Claude Code (or any future contributor) working in this repo.

## What this project is

**jamsesh** — a public, mobile-first web app for amateur musicians to share chords, tabs, and lyrics so a group can play together at a jam session or campfire sing-along, without everyone hunting for their own copy of a song.

Two audiences:
- **Public/anonymous visitors** — scan a QR code, browse songs and playlists, pick a song, read whichever part they play (lead guitar, rhythm, bass, drums, keys, lyrics, vocals). No login. Starting or joining a **live session** is also public — no password involved.
- **Contributors** — people adding songs or sheets sit behind a single shared password (see SPEC.md §6). This is explicitly temporary and will be replaced with real per-user auth later — don't build anything that assumes the shared password is permanent.

The standout feature is **live sessions**: a jam leader starts a session against a playlist; everyone else joins via QR code or a 4-letter code, and their phones follow the leader from song to song (via HTMX polling of a fragment route, not WebSockets — see SPEC.md §7), while still being free to browse elsewhere and jump back.

Full data model, routes, and the auth/session mechanisms are in **SPEC.md** — read that before making backend changes. This file is about how to work in the repo day-to-day.

## Tech stack

- **Runtime**: Deno
- **Server**: Hono (TypeScript)
- **Templating**: Hono's built-in JSX renderer. No Pug, no React/Vue/etc.
- **Interactivity**: HTMX first, Alpine.js only for small pockets of pure client-side state where there's genuinely nothing to fetch from the server. No client-side framework, no build step, no bundler.
- **Database**: SQLite via `node:sqlite`
- **Deployment**: built to run inside Smallweb, but must also run as a plain standalone Deno app. See SPEC.md §8 before adding anything that only works under one of the two.

## There is no JSON API

Every route renders either a full page or an HTML fragment for an HTMX swap (SPEC.md §5). Don't add a `/api/*` JSON route "just in case" — if a real need for JSON comes up later, add it deliberately then, scoped to that need.

## Running it

```
deno task dev
```

(Confirm/update the actual task name in `deno.json` once the project is scaffolded — keep this section accurate as that settles.)

Data directory: `SMALLWEB_DATA_DIR` when running under Smallweb, falling back to `./data` standalone (SPEC.md §8). Don't hardcode a path — always go through the same helper that resolves this.

## Conventions

- **IDs**: UUIDs everywhere (`crypto.randomUUID()`), not autoincrement integers.
- **Naming**: camelCase in TypeScript, snake_case in SQLite column names — the DB layer (`src/db/client.ts`) is responsible for translating at the boundary. Don't leak snake_case into JSX components.
- **Sheet types**: fixed enum (`lyrics`, `lead_guitar`, `rhythm_guitar`, `bass`, `drums`, `keys`, `vocals`, `other`) plus a free-text `customLabel` only when `sheetType === "other"`. Don't add new hardcoded types without updating both the enum in `src/db/client.ts`'s types and the chip list in the add-sheet form.
- **Chord/tab content**: stored and rendered as plain text, monospace font, chords typed inline by whoever adds the sheet. Do not introduce a markup language (e.g. ChordPro) — that was a deliberate simplicity call.
- **Two separate "auth-ish" concerns — do not conflate them**:
  1. **Contributor auth** (SPEC.md §6): a single shared password gating song/sheet/playlist management. Lives entirely behind the `requireAuth` middleware in `src/lib/auth.ts`.
  2. **Session leader tokens** (SPEC.md §7): per-jam-session, cookie-based, fully anonymous, unrelated to the shared password. A person leading a campfire jam should never be asked for the contributor password.
- **Sessions are polling-based**, not WebSocket-based, in v1 — `hx-trigger="every 4s"` against `/fragments/sessions/:code`. Don't introduce a WebSocket dependency without discussing it first (SPEC.md §9 has the upgrade path if latency ever becomes a real problem).

## Design direction

Mobile-first, clean and minimal, high contrast, should work in both light and dark mode. Signature visual motif: thin fading "string lines" (like six guitar strings) used as dividers/active-state indicators — this is intentional and specific to the project, not a generic decorative element, so keep using it rather than introducing new decorative patterns.

Static screenshots from the design mockup pass exist (named `01-songs-list.png` through `07-add-sheet.png`) — treat them as the source of truth for screen layout and flow until real pages replace them screen by screen. Typography: Space Grotesk for headings/display, IBM Plex Sans for body text, IBM Plex Mono for chord/tab bodies.

## Things to ask about before assuming

- Whether a given screen/feature needs to work while offline (currently: no, v1 assumes connectivity).
- Whether to replace the shared contributor password with real accounts (currently: no, deliberately deferred, but expected — see SPEC.md §6/§9).
- Whether to move sessions to WebSockets (currently: no, HTMX polling is the deliberate choice for v1 simplicity/robustness).
- Whether to add a JSON API (currently: no — see "There is no JSON API" above).

If a task seems to call for any of the above, flag it rather than just building it in.
