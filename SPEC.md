# jamsesh — Technical Spec

*A public, mobile-first web app for sharing chords, tabs, and lyrics so a group of amateur musicians can play together — at a jam session, campfire, or practice — without everyone hunting for their own copy of a song.*

## 1. Overview

Two audiences, one app:

- **Public / anonymous** — anyone with the link or QR code can browse songs and playlists, pick a song, and view whichever "sheet" (part) they play. No login required. Anyone can also start or join a **live session** (see §7) without logging in — leading a jam is a public action, not a contributor action.
- **Contributors** — people adding songs and sheets sit behind a single shared password (see §6). This is intentionally minimal for v1 and is expected to be replaced with real per-user auth later — don't build anything on top of it that assumes it's permanent. Keep the shared-password mechanism isolated so swapping it out later doesn't ripple through the rest of the app.

The centerpiece feature beyond "tab library" is **live sessions**: someone leading a jam starts a session against a playlist, everyone scans a QR code or enters a 4-letter code to join, and their phones follow along as the leader moves from song to song — while still being free to browse elsewhere and jump back.

## 2. Goals / Non-goals

**Goals**
- Fast, zero-friction entry from a QR code scan to readable chords, on a phone, outdoors, possibly on bad wifi.
- Dead-simple content model: a song has one or more sheets (lead guitar, rhythm, bass, drums, keys, lyrics, vocals, or a custom "other" part).
- Live session sync via polling (simple, robust on flaky connections — no WebSocket infra needed for v1).
- Content entry with plain text, chords typed inline (no markup language to learn).
- Server-rendered HTML + HTMX for interactivity — no client-side framework, no build step, no JSON API to maintain in parallel.

**Non-goals (v1)**
- Real user accounts / per-user permissions (see §6 — shared password only, deliberately temporary).
- A JSON API. Every route either renders a full page or an HTML fragment for an HTMX swap. If a future client needs JSON, add it then — don't speculatively build it now.
- Real-time WebSocket sync (a possible v2 upgrade path — see §9).
- Native chord-diagram rendering, audio playback, or tuner/metronome features.
- Offline-first / installable PWA behavior (could be added later).

## 3. Tech stack

- **Runtime**: Deno
- **Server framework**: Hono (TypeScript)
- **Templating**: Hono's built-in JSX renderer — server-rendered components, no Pug, no client framework
- **Interactivity**: [HTMX](https://htmx.org) for dynamic bits (search-as-you-type, form submits, session polling, swapping fragments). [Alpine.js](https://alpinejs.dev) only where a sprinkle of pure client-side state is genuinely simpler than a round-trip (e.g. toggling a chip's selected style before submit, a dark/light mode class toggle). Default to HTMX first; reach for Alpine only when there's nothing to fetch from the server.
- **Database**: SQLite via `node:sqlite` (matches the pattern in the sibling `preview` app)
- **Deployment**: designed to run inside [Smallweb](https://smallweb.run) (see §8), but must also run as a **standalone Deno app** with no Smallweb-specific code path — Smallweb just needs to be able to invoke `main.ts` with the repo root as its working directory.

## 4. Data model

### 4.1 Schema (SQLite)

```sql
CREATE TABLE songs (
  id          TEXT PRIMARY KEY,          -- uuid
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  song_key    TEXT,                      -- e.g. "C", "Am" ('key' is a reserved-ish word, avoid it)
  tempo       INTEGER,                   -- bpm, optional
  tags        TEXT,                      -- JSON array of strings, e.g. ["campfire","sing-along"]
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sheets (
  id            TEXT PRIMARY KEY,        -- uuid
  song_id       TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sheet_type    TEXT NOT NULL,           -- enum, see SheetType below
  custom_label  TEXT,                    -- only used when sheet_type = 'other'
  version_label TEXT,                    -- optional, e.g. "Capo 2 version", "Simplified"
  body          TEXT NOT NULL,           -- plain text, chords typed inline
  difficulty    TEXT,                    -- 'beginner' | 'intermediate' | 'advanced', optional
  tuning        TEXT,                    -- e.g. "Standard", "Drop D"
  capo          INTEGER,                 -- fret number, optional
  author_name   TEXT,                    -- free text; not tied to the contributor password gate
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,          -- 0-indexed order within the playlist
  PRIMARY KEY (playlist_id, song_id)
);

-- Live jam sessions. Nothing to do with contributor auth (see §6) — these are
-- public and anonymous by design, driven by a per-session leader token.
CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,   -- 4-letter join code, e.g. "FIRE"
  leader_token      TEXT NOT NULL,          -- long random string, verified against a cookie (see §7)
  playlist_id       TEXT REFERENCES playlists(id) ON DELETE SET NULL,
  current_song_id   TEXT REFERENCES songs(id) ON DELETE SET NULL,
  current_sheet_id  TEXT REFERENCES sheets(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'ended'
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sheets_song_id ON sheets(song_id);
CREATE INDEX idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX idx_sessions_code ON sessions(code);
```

**Notes**
- No `users` table in v1. The shared contributor password (§6) is verified against an env var / a single config value, not a DB row — there's nothing to look up per-user because there are no per-user accounts yet.
- `tags` is stored as a JSON string rather than a join table — fine at this scale, easy to upgrade later if tag-based browsing becomes a real feature.
- All IDs are UUIDs (`crypto.randomUUID()`), not autoincrement, so IDs can be generated before a save round-trip if ever useful.

### 4.2 TypeScript types

```typescript
export type SheetType =
  | "lyrics"
  | "lead_guitar"
  | "rhythm_guitar"
  | "bass"
  | "drums"
  | "keys"
  | "vocals"
  | "other";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Song {
  id: string;
  title: string;
  artist: string;
  songKey?: string;
  tempo?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Sheet {
  id: string;
  songId: string;
  sheetType: SheetType;
  customLabel?: string;      // required when sheetType === "other"
  versionLabel?: string;
  body: string;
  difficulty?: Difficulty;
  tuning?: string;
  capo?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;         // derived, not stored
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistWithSongs extends Playlist {
  songs: Song[];             // ordered by position
}

export interface JamSession {
  id: string;
  code: string;
  playlistId?: string;
  currentSongId?: string;
  currentSheetId?: string;
  status: "active" | "ended";
  updatedAt: string;
}
```

These types back the JSX components and DB layer — they're not exposed as a JSON contract to anything external (see §2, non-goals).

## 5. Routes

Since there's no JSON API, every route is one of two things:

- A **page route** — returns a full HTML document (uses the shared layout, includes `<head>` with htmx.js/alpine.js/styles.css)
- A **fragment route** — returns a bare HTML snippet meant to be swapped into a page by HTMX (`hx-get`/`hx-post`/etc. with `hx-target`)

### 5.1 Public pages

| Method | Path | Description |
|---|---|---|
| GET | `/` | Songs list (search + browse). Search box uses `hx-get` against a fragment route as the user types. |
| GET | `/songs/:id` | Song detail — sheet tabs across top, chord/lyric body below |
| GET | `/playlists` | Playlists list |
| GET | `/playlists/:id` | Playlist detail — ordered songs, "Start session" |
| GET | `/join` | Enter a 4-letter code, or land here from a scanned QR (`/join?code=FIRE`) |

### 5.2 Public fragments (HTMX targets)

| Method | Path | Description |
|---|---|---|
| GET | `/fragments/songs?q=` | Song list rows filtered by search — swapped into `/`'s list container on keyup |
| GET | `/fragments/sessions/:code` | Current session state (song/sheet + leader position) — polled every ~4s by any page showing a live-session banner |

### 5.3 Contributor pages (require the shared password — see §6)

| Method | Path | Description |
|---|---|---|
| GET | `/login` | Login form |
| GET | `/add-song` | Add song form |
| GET | `/songs/:id/add-sheet` | Add sheet form, scoped to a song |
| GET | `/playlists/new` | Create playlist form |
| GET | `/playlists/:id/edit` | Rename / reorder / add-remove songs in a playlist |

### 5.4 Contributor mutations (HTMX form posts; require the shared password)

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Verify password, set signed auth cookie, redirect to `/` |
| POST | `/logout` | Clear auth cookie, redirect to `/` |
| POST | `/songs` | Create a song → redirects to its add-sheet form |
| PATCH | `/songs/:id` | Update a song |
| DELETE | `/songs/:id` | Delete a song (cascades to its sheets) |
| POST | `/songs/:id/sheets` | Add a sheet → redirects/swaps to the song detail view with the new tab active |
| PATCH | `/sheets/:id` | Update a sheet |
| DELETE | `/sheets/:id` | Delete a sheet |
| POST | `/playlists` | Create a playlist |
| PATCH | `/playlists/:id` | Rename a playlist |
| DELETE | `/playlists/:id` | Delete a playlist |
| POST | `/playlists/:id/songs` | Add a song to a playlist |
| DELETE | `/playlists/:id/songs/:songId` | Remove a song from a playlist |
| POST | `/playlists/:id/reorder` | Reorder songs (simple up/down controls or a small Alpine-driven drag list; posts the new order) |

### 5.5 Sessions (public — no password required; see §7 for the leader-token mechanism)

| Method | Path | Description |
|---|---|---|
| POST | `/sessions` | Start a session from a playlist or song. Sets a leader cookie scoped to the new session code, then redirects to the playlist/song view in "leading mode." |
| POST | `/sessions/:code/advance` | Leader-only: set the current song/sheet. Verified via the leader cookie, not a password. |
| POST | `/sessions/:code/end` | Leader-only: end the session. |

## 6. Contributor auth (shared password — temporary)

This exists only to keep the content-management side from being wide open to the public internet. It is explicitly a placeholder:

- A single password, set via the `JAMSESH_PASSWORD` env var (default for local dev only, same pattern as the sibling `preview` app's `PREVIEW_PASSWORD`).
- `POST /login` checks the submitted password against it and, if correct, sets a signed cookie (Hono's built-in cookie signing, a secret from env). No session table, no per-user rows — there's nothing to look up.
- A small `requireAuth` middleware in `src/lib/auth.ts` guards the contributor routes in §5.3/§5.4. Keep this middleware as the *only* place that knows how auth currently works, so replacing "shared password" with real per-user accounts later is a localized change — swap what's inside `requireAuth` and the login route, not anything that calls it.
- **Do not** let this shared-password mechanism leak into the sessions/leader-token flow (§7) — those are deliberately separate concerns. A random person leading a campfire jam should never need the contributor password.

## 7. Live sessions in detail

- `POST /sessions` creates a row in `sessions`, generates a 4-letter `code` and a long random `leader_token`, and sets a cookie (e.g. `leader_<code>=<token>`) on the response, scoped to that session. Whoever's browser started the session is now "the leader" for it — no login involved.
- Any page can show a **session banner** (see the design mockups) once a session code is known to the client — either because they're the leader, or because they joined via `/join?code=FIRE`. That banner's content comes from `GET /fragments/sessions/:code`, polled on an interval (`hx-trigger="every 4s"`).
- `POST /sessions/:code/advance` is only accepted if the request's `leader_<code>` cookie matches the stored `leader_token` — otherwise 403. This is what lets the leader tap a song in the playlist view and have it push out to everyone polling that fragment.
- Non-leaders are never locked into the leader's view — they can navigate anywhere; the session banner (wherever it's shown) always offers a "jump to what the leader's on" link, per the UX decision made during the mockup pass.

## 8. Deployment (Smallweb)

Mirrors the sibling `preview` app:

```
~/smallweb/
└── jamsesh/           ← this repo
    ├── main.ts
    ├── src/
    └── static/
```

- Smallweb serves the app by running `main.ts` via Deno, with the repo root as the working directory. `static/` is served relative to `Deno.cwd()`, so the app must always be run with the repo root as CWD — both locally and under Smallweb (which does this automatically).
- Smallweb sets `SMALLWEB_DATA_DIR` to a per-app data directory; the app uses that path for the SQLite database, falling back to `./data` when running standalone (same fallback pattern as the sibling app).
- `JAMSESH_PASSWORD` is set in the Smallweb app config at deploy time (see §6).
- The app must also run as a **plain standalone Deno app** (`deno task dev` locally) with no Smallweb-specific imports or code paths — Smallweb compatibility comes entirely from respecting `SMALLWEB_DATA_DIR`/CWD conventions, not from a Smallweb SDK dependency.

## 9. Future work / upgrade paths (not v1)

- **Real auth**: replace the shared password (§6) with real per-contributor accounts. `sheets.author_name` becomes a real `author_id` FK; add an `owner_id` to `songs`/`playlists` if edit permissions become a thing. `requireAuth` is the one place this touches.
- **WebSockets**: swap the `/fragments/sessions/:code` polling for a `Deno.upgradeWebSocket` connection if 4-second latency ever feels too slow live — the `sessions` table doesn't need to change, just the transport and the HTMX polling attribute (HTMX has a websocket extension if we stay in the HTMX world).
- **Offline/PWA**: cache songs/sheets for offline viewing at a campsite with no signal at all.
- **Chord diagrams**: render actual fretboard diagrams from chord names found in the sheet body (would need a chord-name parser).

## 10. Folder structure

```
main.ts                      Entry point — wires Hono app, DB, and routes
src/
  db/
    schema.sql
    client.ts                 node:sqlite connection + query helpers (SongsDB, SheetsDB, PlaylistsDB, SessionsDB)
  routes/
    pages.ts                  Full-page routes (§5.1, §5.3)
    fragments.ts               HTMX fragment routes (§5.2)
    sessions.ts                 Session start/advance/end routes (§5.5, §7)
    auth.ts                     Login/logout routes (§6)
  lib/
    auth.ts                     requireAuth middleware, cookie signing helpers
    session-code.ts             4-letter code generation, leader token helpers
    layout.tsx                  Shared JSX layout (head, htmx/alpine script tags, styles.css link)
  components/                   Hono JSX components — SongRow, SheetTabs, SessionBanner, PlaylistCard, etc.
static/
  styles.css
  htmx.min.js
  alpine.min.js                 (only if/when Alpine is actually needed somewhere)
deno.json
SPEC.md
CLAUDE.md
```
