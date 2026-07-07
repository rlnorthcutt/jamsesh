# jamsesh

A public, mobile-first web app for musicians to share chords, tabs, and lyrics so a group can play together — at a jam session, campfire, or practice — without everyone hunting for their own copy of a song.

## What it does

- **Browse songs and playlists** — anyone with the link can read chords, tabs, or lyrics for whichever part they play (lead guitar, rhythm, bass, drums, keys, lyrics, vocals). No login required.
- **Live sessions** — a jam leader starts a session against a playlist; everyone joins via QR code or a 4-letter code, and their phones follow the leader from song to song in real time.
- **Content management** — contributors with the shared password can add songs, sheets, and playlists.

## Tech stack

- **Runtime**: Deno
- **Server**: Hono (TypeScript)
- **Templating**: Hono JSX (server-rendered, no client framework)
- **Interactivity**: HTMX for search-as-you-type, session polling, and form swaps
- **Database**: SQLite via `node:sqlite`
- **Deployment**: Smallweb, or plain standalone Deno

## Running locally

```sh
# First-time setup: download htmx
deno task setup

# Start dev server
deno task dev
```

The app runs at `http://localhost:8000` by default.

**Default contributor password**: `campfire`  
Override with the `JAMSESH_PASSWORD` env var.

## Running tests

```sh
deno task test
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `JAMSESH_PASSWORD` | `campfire` | Shared contributor password |
| `JAMSESH_COOKIE_SECRET` | `dev-cookie-secret-change-me` | Signs auth cookies — change in production |
| `SMALLWEB_DATA_DIR` | `./data` | Where the SQLite database is stored |
| `PORT` | `8000` | HTTP port (standalone mode) |

## Deployment (Smallweb)

Drop the repo into your Smallweb directory and set the env vars in the app config. Smallweb runs `main.ts` with the repo root as the working directory and sets `SMALLWEB_DATA_DIR` automatically.

```
~/smallweb/
└── jamsesh/
    ├── main.ts
    ├── src/
    └── static/
```

## Project structure

```
main.ts                  Entry point — wires Hono, DB, and routes
src/
  db/
    schema.sql           SQLite schema
    client.ts            DB helpers (songs, sheets, playlists, sessions)
  routes/
    pages.tsx            Full-page routes
    fragments.tsx        HTMX fragment routes
    sessions.ts          Live session routes
    auth.tsx             Login / logout
  lib/
    auth.ts              requireAuth middleware + cookie helpers
    session-code.ts      4-letter code + leader token generation
    layout.tsx           Shared JSX layout
  components/            Reusable JSX components
  types/
    index.ts             Shared TypeScript types
static/
  styles.css
  htmx.min.js
scripts/
  setup.ts               Downloads htmx.min.js
tests/
  db.test.ts
  routes.test.ts
```

## Design notes

Mobile-first, high contrast, works in light and dark mode. Typography: Space Grotesk for headings, IBM Plex Sans for body, IBM Plex Mono for chord/tab content. The thin horizontal "string lines" divider motif is intentional — don't replace it with generic dividers.

See `SPEC.md` for the full technical spec and `CLAUDE.md` for contributor guidance.
