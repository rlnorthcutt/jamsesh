import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireAuth, isAuthenticated } from "../lib/auth.ts";
import { Layout, page } from "../lib/layout.tsx";
import { SongRow } from "../components/SongRow.tsx";
import { PlaylistCard } from "../components/PlaylistCard.tsx";
import { StringsDivider } from "../components/StringsDivider.tsx";
import { SessionBanner } from "../components/SessionBanner.tsx";
import type { Db, Song, Sheet } from "../db/client.ts";
import { SHEET_TYPE_LABELS, type SheetType, type Difficulty } from "../types/index.ts";

function mutationRedirect(c: { req: { header: (k: string) => string | undefined }, redirect: (url: string) => Response }, url: string): Response {
  return c.redirect(url);
}

export function pageRoutes(db: Db) {
  const app = new Hono();

  // ── Public pages ────────────────────────────────────────────────────────────

  app.get("/", (c) => {
    const sessionCode = getCookie(c, "session_code");
    const songs = db.songs.list();
    return c.html(page(
      <Layout title="Songs" activeNav="songs" sessionCode={sessionCode}>
        <div class="app-header">
          <h1>Songs</h1>
          <input
            class="search"
            type="search"
            name="q"
            placeholder="Search song or artist…"
            hx-get="/fragments/songs"
            hx-trigger="keyup changed delay:300ms, search"
            hx-target="#song-list"
            hx-swap="innerHTML"
            autocomplete="off"
          />
        </div>
        <div id="song-list" class="list">
          {songs.length
            ? songs.map((s) => <SongRow song={s} />)
            : <div class="empty-hint">No songs yet.<br />Add the first one with the + button.</div>}
        </div>
        <a href="/add-song" class="fab" title="Add song">+</a>
      </Layout>
    ));
  });

  app.get("/songs/:id", async (c) => {
    const song = db.songs.get(c.req.param("id")!);
    if (!song) return c.notFound();

    const sheets = db.sheets.forSong(song.id);
    const sessionCode = getCookie(c, "session_code");
    const activeSheetId = c.req.query("sheet") ?? sheets[0]?.id;
    const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0];
    const authed = await isAuthenticated(c);

    return c.html(page(
      <Layout title={song.title} activeNav="songs" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <div class="detail-header-top">
            <a href="/" class="back-row" style="margin-bottom:0">← Songs</a>
            {authed && (
              <a href={`/songs/${song.id}/edit`} class="icon-btn" title="Edit song">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </a>
            )}
          </div>
          <div class="song-title-block">
            <h2>{song.title}</h2>
            <div class="artist">{song.artist}</div>
          </div>
          <div class="meta-row">
            {song.songKey && <span>Key <b>{song.songKey}</b></span>}
            {activeSheet?.tuning && <span>Tuning <b>{activeSheet.tuning}</b></span>}
            {activeSheet?.capo && <span>Capo <b>{activeSheet.capo}</b></span>}
          </div>
        </div>

        {(sheets.length > 0 || authed) && (
          <div class="sheet-tabs">
            {sheets.map((sh) => (
              <a
                href={`/songs/${song.id}?sheet=${sh.id}`}
                class={`sheet-tab${sh.id === activeSheet?.id ? " active" : ""}`}
              >
                {sheetLabel(sh)}
              </a>
            ))}
            {authed && (
              <a href={`/songs/${song.id}/add-sheet`} class="sheet-tab sheet-tab--add" title="Add sheet">+</a>
            )}
          </div>
        )}

        {activeSheet
          ? (
            <>
              {authed && (
                <div class="controls-row">
                  <a href={`/songs/${song.id}/sheets/${activeSheet.id}/edit`} class="pill-btn">Edit</a>
                </div>
              )}
              <div class="chord-body">{activeSheet.body}</div>
            </>
          )
          : (
            <div class="empty-hint">
              No sheets yet.
              {authed && (
                <>{" "}<a href={`/songs/${song.id}/add-sheet`} style="color:var(--accent)">Add the first one →</a></>
              )}
            </div>
          )}
      </Layout>
    ));
  });

  app.get("/playlists", (c) => {
    const sessionCode = getCookie(c, "session_code");
    const playlists = db.playlists.list();
    return c.html(page(
      <Layout title="Playlists" activeNav="playlists" sessionCode={sessionCode}>
        <div class="app-header">
          <h1>Playlists</h1>
        </div>
        <StringsDivider />
        <div class="list" style="padding-top:0">
          {playlists.length
            ? playlists.map((pl) => <PlaylistCard playlist={pl} />)
            : <div class="empty-hint">No playlists yet.<br />Create one with the + button.</div>}
        </div>
        <a href="/playlists/new" class="fab" title="New playlist">+</a>
      </Layout>
    ));
  });

  // must come before /playlists/:id or "new" matches the dynamic segment
  app.get("/playlists/new", requireAuth, (c) => {
    const sessionCode = getCookie(c, "session_code");
    return c.html(page(
      <Layout title="New playlist" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href="/playlists" class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">New playlist</h2>
        </div>
        <div class="form-wrap">
          <form method="post" action="/playlists">
            <div class="field">
              <label for="name">Name</label>
              <input type="text" id="name" name="name" placeholder="e.g. Campfire cathedral" required autofocus />
            </div>
            <button type="submit" class="primary-btn">Create playlist</button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.get("/playlists/:id", (c) => {
    const playlist = db.playlists.get(c.req.param("id")!);
    if (!playlist) return c.notFound();

    const sessionCode = getCookie(c, "session_code");
    const activeCode = sessionCode;

    return c.html(page(
      <Layout title={playlist.name} activeNav="playlists" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href="/playlists" class="back-row">← Playlists</a>
          <div class="song-title-block">
            <h2>{playlist.name}</h2>
            <div class="artist">{playlist.songCount} songs</div>
          </div>
        </div>
        <div class="controls-row">
          <form method="post" action="/sessions" style="display:inline">
            <input type="hidden" name="playlist_id" value={playlist.id} />
            <button type="submit" class="pill-btn pill-btn--accent">▶ Start session</button>
          </form>
          <a href={`/playlists/${playlist.id}/edit`} class="pill-btn">Edit</a>
        </div>
        <div class="list" style="padding-top:0">
          {playlist.songs.length
            ? playlist.songs.map((s) => <SongRow song={{ ...s, sheetCount: 0 }} />)
            : <div class="empty-hint">No songs in this playlist yet.</div>}
        </div>
      </Layout>
    ));
  });

  app.get("/join", (c) => {
    const code = c.req.query("code")?.toUpperCase() ?? "";
    const error = c.req.query("error");
    const leading = c.req.query("leading") === "1";
    const sessionCode = getCookie(c, "session_code");

    let session = null;
    if (leading && sessionCode) {
      session = db.sessions.getByCode(sessionCode);
    }

    return c.html(page(
      <Layout title="Session" activeNav="session" sessionCode={!leading ? sessionCode : undefined}>
        <div class="app-header"><h1>Session</h1></div>
        {leading && session
          ? (
            <div class="center-block">
              <div class="section-title">Your session code</div>
              <div class="code-display">{session.code}</div>
              <p style="font-size:13px; color:var(--text-dim); margin:0">
                Share this code so others can join. Their phones will follow yours.
              </p>
              <form method="post" action={`/sessions/${session.code}/end`} style="width:100%">
                <button type="submit" class="primary-btn" style="background:var(--text); color:var(--bg)">
                  End session
                </button>
              </form>
            </div>
          )
          : (
            <div class="center-block">
              {error === "notfound" && (
                <div class="error-banner">Session "{code}" not found or has ended.</div>
              )}
              <p style="font-size:13px; color:var(--text-dim); margin:0">
                Enter the 4-letter code from the session leader
              </p>
              <form method="post" action="/join" style="width:100%; display:flex; flex-direction:column; gap:12px; align-items:center">
                <input
                  type="text"
                  name="code"
                  value={code}
                  placeholder="e.g. FIRE"
                  maxlength={4}
                  autocomplete="off"
                  style="font-family:var(--font-mono); font-size:32px; font-weight:600; letter-spacing:6px; text-align:center; text-transform:uppercase; width:100%; padding:14px 20px; background:var(--surface); border:1px solid var(--line); border-radius:12px; color:var(--text)"
                />
                <button type="submit" class="primary-btn" style="width:auto; padding:12px 28px">
                  Join session
                </button>
              </form>
              <div style="font-size:12px; color:var(--text-dim)">
                Leading a jam?{" "}
                <a href="/playlists" style="color:var(--accent); font-weight:600; text-decoration:none">
                  Start one from a playlist →
                </a>
              </div>
            </div>
          )}
      </Layout>
    ));
  });

  // ── Contributor pages (require auth) ────────────────────────────────────────

  app.get("/add-song", requireAuth, (c) => {
    const sessionCode = getCookie(c, "session_code");
    return c.html(page(
      <Layout title="Add song" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href="/" class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">Add a song</h2>
        </div>
        <div class="form-wrap">
          <form method="post" action="/songs">
            <div class="field">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" placeholder="e.g. Pink Moon" required />
            </div>
            <div class="field">
              <label for="artist">Artist</label>
              <input type="text" id="artist" name="artist" placeholder="e.g. Nick Drake" required />
            </div>
            <div class="field">
              <label for="song_key">Key (optional)</label>
              <input type="text" id="song_key" name="song_key" placeholder="e.g. C, Am" />
            </div>
            <div class="field">
              <label for="tempo">Tempo / BPM (optional)</label>
              <input type="number" id="tempo" name="tempo" placeholder="e.g. 120" min={40} max={300} />
            </div>
            <button type="submit" class="primary-btn">Save song &amp; add first sheet</button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.get("/songs/:id/add-sheet", requireAuth, (c) => {
    const song = db.songs.get(c.req.param("id")!);
    if (!song) return c.notFound();
    const sessionCode = getCookie(c, "session_code");

    const sheetTypes: SheetType[] = ["lyrics", "lead_guitar", "rhythm_guitar", "bass", "drums", "keys", "vocals", "other"];

    return c.html(page(
      <Layout title="Add sheet" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href={`/songs/${song.id}`} class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">Add a sheet</h2>
          <div style="font-size:12.5px; color:var(--text-dim); margin-top:4px">
            for "{song.title}" — {song.artist}
          </div>
        </div>
        <div class="form-wrap">
          <form method="post" action={`/songs/${song.id}/sheets`}>
            <div class="field">
              <label>Part</label>
              <div class="chip-row">
                {sheetTypes.map((t, i) => (
                  <label class="chip">
                    <input type="radio" name="sheet_type" value={t} required checked={i === 0} />
                    {SHEET_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
            <div class="field" id="custom-label-field" style="display:none">
              <label for="custom_label">Custom part name</label>
              <input type="text" id="custom_label" name="custom_label" placeholder="e.g. Fingerstyle" />
            </div>
            <div class="field">
              <label for="version_label">Version label (optional)</label>
              <input type="text" id="version_label" name="version_label" placeholder="e.g. Simplified, Capo 2 version" />
            </div>
            <div class="field">
              <label for="author_name">Your name (optional)</label>
              <input type="text" id="author_name" name="author_name" placeholder="so others know who added this" />
            </div>
            <div class="field">
              <label for="tuning">Tuning (optional)</label>
              <input type="text" id="tuning" name="tuning" placeholder="e.g. Standard, Drop D" />
            </div>
            <div class="field">
              <label for="capo">Capo fret (optional)</label>
              <input type="number" id="capo" name="capo" placeholder="e.g. 2" min={0} max={12} />
            </div>
            <div class="field">
              <label for="body">Chords &amp; lyrics</label>
              <textarea
                id="body"
                name="body"
                placeholder={"[Verse]\nC          Am\nPink moon gonna get ye all"}
                required
              />
            </div>
            <button type="submit" class="primary-btn">Save sheet</button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.get("/songs/:id/edit", requireAuth, (c) => {
    const song = db.songs.get(c.req.param("id")!);
    if (!song) return c.notFound();
    const sessionCode = getCookie(c, "session_code");

    return c.html(page(
      <Layout title="Edit song" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href={`/songs/${song.id}`} class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">Edit song</h2>
        </div>
        <div class="form-wrap">
          <form method="post" action={`/songs/${song.id}/update`}>
            <div class="field">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" value={song.title} required />
            </div>
            <div class="field">
              <label for="artist">Artist</label>
              <input type="text" id="artist" name="artist" value={song.artist} required />
            </div>
            <div class="field">
              <label for="song_key">Key (optional)</label>
              <input type="text" id="song_key" name="song_key" value={song.songKey ?? ""} />
            </div>
            <div class="field">
              <label for="tempo">Tempo / BPM (optional)</label>
              <input type="number" id="tempo" name="tempo" value={song.tempo ?? ""} />
            </div>
            <button type="submit" class="primary-btn">Save changes</button>
          </form>
          <form method="post" action={`/songs/${song.id}/delete`} style="margin-top:16px"
            onsubmit="return confirm('Delete this song and all its sheets?')">
            <button type="submit" class="primary-btn" style="background:transparent; color:var(--text-dim); border:1px solid var(--line)">
              Delete song
            </button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.get("/songs/:id/sheets/:sheetId/edit", requireAuth, (c) => {
    const song = db.songs.get(c.req.param("id")!);
    const sheet = db.sheets.get(c.req.param("sheetId")!);
    if (!song || !sheet) return c.notFound();
    const sessionCode = getCookie(c, "session_code");
    const label = sheetLabel(sheet);
    const sheetTypes: SheetType[] = ["lyrics", "lead_guitar", "rhythm_guitar", "bass", "drums", "keys", "vocals", "other"];

    return c.html(page(
      <Layout title={`Edit ${label}`} sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href={`/songs/${song.id}?sheet=${sheet.id}`} class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">Edit {label}</h2>
          <div style="font-size:12.5px; color:var(--text-dim); margin-top:4px">
            for "{song.title}" — {song.artist}
          </div>
        </div>
        <div class="form-wrap">
          <form method="post" action={`/songs/${song.id}/sheets/${sheet.id}/update`}>
            <div class="field">
              <label>Part</label>
              <div class="chip-row">
                {sheetTypes.map((t) => (
                  <label class="chip">
                    <input type="radio" name="sheet_type" value={t} checked={t === sheet.sheetType} required />
                    {SHEET_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
            {sheet.sheetType === "other" && (
              <div class="field">
                <label for="custom_label">Custom part name</label>
                <input type="text" id="custom_label" name="custom_label"
                  value={sheet.customLabel ?? ""}
                  placeholder="e.g. Fingerstyle" />
              </div>
            )}
            <div class="field">
              <label for="version_label">Version label (optional)</label>
              <input type="text" id="version_label" name="version_label"
                value={sheet.versionLabel ?? ""}
                placeholder="e.g. Simplified, Capo 2 version" />
            </div>
            <div class="field">
              <label for="author_name">Author name (optional)</label>
              <input type="text" id="author_name" name="author_name"
                value={sheet.authorName ?? ""}
                placeholder="so others know who added this" />
            </div>
            <div class="field">
              <label for="tuning">Tuning (optional)</label>
              <input type="text" id="tuning" name="tuning"
                value={sheet.tuning ?? ""}
                placeholder="e.g. Standard, Drop D" />
            </div>
            <div class="field">
              <label for="capo">Capo fret (optional)</label>
              <input type="number" id="capo" name="capo"
                value={sheet.capo ?? ""}
                min={0} max={12} />
            </div>
            <div class="field">
              <label for="body">Chords &amp; lyrics</label>
              <textarea id="body" name="body" required>{sheet.body}</textarea>
            </div>
            <button type="submit" class="primary-btn">Save changes</button>
          </form>
          <form method="post" action={`/songs/${song.id}/sheets/${sheet.id}/delete`}
            style="margin-top:16px"
            onsubmit="return confirm('Delete this sheet?')">
            <button type="submit" class="primary-btn"
              style="background:transparent; color:var(--text-dim); border:1px solid var(--line)">
              Delete sheet
            </button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.get("/playlists/:id/edit", requireAuth, (c) => {
    const playlist = db.playlists.get(c.req.param("id")!);
    if (!playlist) return c.notFound();
    const allSongs = db.songs.list();
    const inPlaylist = new Set(playlist.songs.map((s) => s.id));
    const sessionCode = getCookie(c, "session_code");

    return c.html(page(
      <Layout title={`Edit ${playlist.name}`} sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href={`/playlists/${playlist.id}`} class="back-row">← Cancel</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0">Edit playlist</h2>
        </div>
        <div class="form-wrap">
          <form method="post" action={`/playlists/${playlist.id}/rename`}>
            <div class="field">
              <label for="name">Name</label>
              <input type="text" id="name" name="name" value={playlist.name} required />
            </div>
            <button type="submit" class="primary-btn" style="margin-bottom:24px">Save name</button>
          </form>

          <div class="section-title">Songs in playlist</div>
          {playlist.songs.map((s, i) => (
            <div class="row" style="align-items:center">
              <div class="row-main">
                <div class="row-title">{s.title}</div>
                <div class="row-sub">{s.artist}</div>
              </div>
              <form method="post" action={`/playlists/${playlist.id}/songs/${s.id}/remove`}>
                <button type="submit" class="pill-btn" style="font-size:11px; padding:5px 10px">Remove</button>
              </form>
            </div>
          ))}

          <div class="section-title" style="margin-top:20px">Add songs</div>
          {allSongs.filter((s) => !inPlaylist.has(s.id)).map((s) => (
            <div class="row" style="align-items:center">
              <div class="row-main">
                <div class="row-title">{s.title}</div>
                <div class="row-sub">{s.artist}</div>
              </div>
              <form method="post" action={`/playlists/${playlist.id}/songs`}>
                <input type="hidden" name="song_id" value={s.id} />
                <button type="submit" class="pill-btn" style="font-size:11px; padding:5px 10px">Add</button>
              </form>
            </div>
          ))}
        </div>
      </Layout>
    ));
  });

  // ── Contributor mutations ────────────────────────────────────────────────────

  app.post("/songs", requireAuth, async (c) => {
    const form = await c.req.formData();
    const title = (form.get("title") as string)?.trim();
    const artist = (form.get("artist") as string)?.trim();
    if (!title || !artist) return c.redirect("/add-song");
    const tempo = form.get("tempo") ? Number(form.get("tempo")) : undefined;
    const song = db.songs.create({ title, artist, songKey: form.get("song_key") as string || undefined, tempo });
    return c.redirect(`/songs/${song.id}/add-sheet`);
  });

  app.post("/songs/:id/update", requireAuth, async (c) => {
    const id = c.req.param("id")!;
    const form = await c.req.formData();
    const tempo = form.get("tempo") ? Number(form.get("tempo")) : undefined;
    const title = (form.get("title") as string | null)?.trim();
    const artist = (form.get("artist") as string | null)?.trim();
    db.songs.update(id, {
      ...(title && { title }),
      ...(artist && { artist }),
      songKey: (form.get("song_key") as string) || undefined,
      tempo,
    });
    return c.redirect(`/songs/${id}`);
  });

  app.post("/songs/:id/delete", requireAuth, (c) => {
    const id = c.req.param("id")!;
    db.songs.delete(id);
    return c.redirect("/");
  });

  app.post("/songs/:id/sheets", requireAuth, async (c) => {
    const songId = c.req.param("id")!;
    if (!db.songs.get(songId)) return c.notFound();
    const form = await c.req.formData();
    const sheetType = (form.get("sheet_type") as SheetType) || "lyrics";
    const body = (form.get("body") as string)?.trim();
    if (!body) return c.redirect(`/songs/${songId}/add-sheet`);
    const capoRaw = form.get("capo");
    const sheet = db.sheets.create({
      songId,
      sheetType,
      body,
      customLabel: form.get("custom_label") as string || undefined,
      versionLabel: form.get("version_label") as string || undefined,
      authorName: form.get("author_name") as string || undefined,
      tuning: form.get("tuning") as string || undefined,
      capo: capoRaw ? Number(capoRaw) : undefined,
    });
    return c.redirect(`/songs/${songId}?sheet=${sheet.id}`);
  });

  app.post("/songs/:id/sheets/:sheetId/update", requireAuth, async (c) => {
    const songId = c.req.param("id")!;
    const sheetId = c.req.param("sheetId")!;
    if (!db.sheets.get(sheetId)) return c.notFound();
    const form = await c.req.formData();
    const capoRaw = form.get("capo");
    const sheetType = form.get("sheet_type") as SheetType | null;
    db.sheets.update(sheetId, {
      ...(sheetType && { sheetType }),
      customLabel: sheetType === "other" ? ((form.get("custom_label") as string) || undefined) : "",
      body: ((form.get("body") as string | null) ?? "").trim() || undefined,
      versionLabel: (form.get("version_label") as string) || undefined,
      authorName: (form.get("author_name") as string) || undefined,
      tuning: (form.get("tuning") as string) || undefined,
      capo: capoRaw ? Number(capoRaw) : undefined,
    });
    return c.redirect(`/songs/${songId}?sheet=${sheetId}`);
  });

  app.post("/songs/:id/sheets/:sheetId/delete", requireAuth, (c) => {
    const songId = c.req.param("id")!;
    const sheetId = c.req.param("sheetId")!;
    db.sheets.delete(sheetId);
    return c.redirect(`/songs/${songId}`);
  });

  app.post("/playlists", requireAuth, async (c) => {
    const form = await c.req.formData();
    const name = (form.get("name") as string)?.trim();
    if (!name) return c.redirect("/playlists/new");
    const playlist = db.playlists.create(name);
    return c.redirect(`/playlists/${playlist.id}/edit`);
  });

  app.post("/playlists/:id/rename", requireAuth, async (c) => {
    const id = c.req.param("id")!;
    const form = await c.req.formData();
    const name = ((form.get("name") as string | null) ?? "").trim();
    if (name) db.playlists.update(id, name);
    return c.redirect(`/playlists/${id}/edit`);
  });

  app.post("/playlists/:id/delete", requireAuth, (c) => {
    db.playlists.delete(c.req.param("id")!);
    return c.redirect("/playlists");
  });

  app.post("/playlists/:id/songs", requireAuth, async (c) => {
    const id = c.req.param("id")!;
    const form = await c.req.formData();
    const songId = form.get("song_id") as string;
    if (songId) db.playlists.addSong(id, songId);
    return c.redirect(`/playlists/${id}/edit`);
  });

  app.post("/playlists/:id/songs/:songId/remove", requireAuth, (c) => {
    db.playlists.removeSong(c.req.param("id")!, c.req.param("songId")!);
    return c.redirect(`/playlists/${c.req.param("id")!}/edit`);
  });

  return app;
}

function sheetLabel(sheet: Sheet): string {
  if (sheet.sheetType === "other" && sheet.customLabel) return sheet.customLabel;
  const base = SHEET_TYPE_LABELS[sheet.sheetType] ?? sheet.sheetType;
  return sheet.versionLabel ? `${base} · ${sheet.versionLabel}` : base;
}
