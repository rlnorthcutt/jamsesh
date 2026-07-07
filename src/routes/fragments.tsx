import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { SongRow } from "../components/SongRow.tsx";
import { SessionBanner, SessionBannerEnded } from "../components/SessionBanner.tsx";
import type { Db } from "../db/client.ts";

export function fragmentRoutes(db: Db) {
  const app = new Hono();

  // Song search results — swapped into #song-list on keyup
  app.get("/fragments/songs", (c) => {
    const q = c.req.query("q") ?? "";
    const songs = db.songs.search(q);
    if (!songs.length) {
      return c.html(
        <div class="empty-hint">
          {q ? `No songs matching "${q}"` : "No songs yet. Add the first one!"}
        </div>
      );
    }
    return c.html(
      <>{songs.map((s) => <SongRow song={s} />)}</>
    );
  });

  // Session state fragment — polled every 4s by the session banner
  app.get("/fragments/sessions/:code", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const session = db.sessions.getByCode(code);

    if (!session || session.status === "ended") {
      return c.html(<SessionBannerEnded code={code} />);
    }

    let songTitle: string | undefined;
    let songArtist: string | undefined;
    let playlistName: string | undefined;

    if (session.currentSongId) {
      const song = db.songs.get(session.currentSongId);
      songTitle = song?.title;
      songArtist = song?.artist;
    }
    if (session.playlistId) {
      const pl = db.playlists.get(session.playlistId);
      playlistName = pl?.name;
    }

    return c.html(
      <SessionBanner
        code={code}
        playlistName={playlistName}
        currentSongTitle={songTitle}
        currentSongArtist={songArtist}
        currentSongId={session.currentSongId}
      />
    );
  });

  return app;
}
