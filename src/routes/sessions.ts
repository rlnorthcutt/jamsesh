import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { generateCode, generateLeaderToken } from "../lib/session-code.ts";
import type { Db } from "../db/client.ts";

export function sessionRoutes(db: Db) {
  const app = new Hono();

  // Start a session (public, no auth required)
  app.post("/sessions", async (c) => {
    const form = await c.req.formData();
    const playlistId = form.get("playlist_id") as string | null;
    const songId = form.get("song_id") as string | null;

    // Generate unique code (retry on collision)
    let code = generateCode();
    let attempts = 0;
    while (db.sessions.getByCode(code) && attempts++ < 10) {
      code = generateCode();
    }

    const leaderToken = generateLeaderToken();
    db.sessions.create({
      code,
      leaderToken,
      playlistId: playlistId ?? undefined,
      currentSongId: songId ?? undefined,
    });

    setCookie(c, `leader_${code}`, leaderToken, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24,
    });
    setCookie(c, "session_code", code, {
      sameSite: "Lax",
      maxAge: 60 * 60 * 24,
    });

    const redirectTo = playlistId
      ? `/playlists/${playlistId}?session=${code}`
      : `/join?code=${code}&leading=1`;
    return c.redirect(redirectTo);
  });

  // Leader advances to a new song/sheet
  app.post("/sessions/:code/advance", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const session = db.sessions.getByCode(code);
    if (!session || session.status === "ended") return c.text("Not found", 404);

    const cookieToken = getCookie(c, `leader_${code}`);
    if (cookieToken !== session.leaderToken) return c.text("Forbidden", 403);

    const form = await c.req.formData();
    const songId = form.get("song_id") as string;
    const sheetId = form.get("sheet_id") as string | null;
    if (!songId) return c.text("song_id required", 400);

    db.sessions.advance(code, songId, sheetId ?? undefined);

    const redirectTo = form.get("redirect") as string | null;
    return c.redirect(redirectTo ?? `/songs/${songId}`);
  });

  // Leader ends the session
  app.post("/sessions/:code/end", (c) => {
    const code = c.req.param("code").toUpperCase();
    const session = db.sessions.getByCode(code);
    if (!session) return c.text("Not found", 404);

    const cookieToken = getCookie(c, `leader_${code}`);
    if (cookieToken !== session.leaderToken) return c.text("Forbidden", 403);

    db.sessions.end(code);
    deleteCookie(c, `leader_${code}`);
    deleteCookie(c, "session_code");
    return c.redirect("/");
  });

  // Join a session by code (sets the session_code cookie)
  app.post("/join", async (c) => {
    const form = await c.req.formData();
    const code = (form.get("code") as string ?? "").toUpperCase().trim();
    const session = db.sessions.getByCode(code);
    if (!session || session.status === "ended") {
      return c.redirect(`/join?error=notfound&code=${code}`);
    }
    setCookie(c, "session_code", code, {
      sameSite: "Lax",
      maxAge: 60 * 60 * 24,
    });
    const dest = session.currentSongId ? `/songs/${session.currentSongId}` : "/";
    return c.redirect(dest);
  });

  return app;
}
