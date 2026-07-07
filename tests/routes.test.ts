import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { Hono } from "hono";
import { createDb } from "../src/db/client.ts";
import { pageRoutes } from "../src/routes/pages.tsx";
import { fragmentRoutes } from "../src/routes/fragments.tsx";
import { sessionRoutes } from "../src/routes/sessions.ts";
import { authRoutes } from "../src/routes/auth.tsx";

function testApp() {
  const db = createDb(":memory:");
  const app = new Hono();
  app.route("/", pageRoutes(db));
  app.route("/", fragmentRoutes(db));
  app.route("/", sessionRoutes(db));
  app.route("/", authRoutes(db));
  return { app, db };
}

// ── Public pages ─────────────────────────────────────────────────────────────

Deno.test("GET / returns songs list page", async () => {
  const { app } = testApp();
  const res = await app.request("/");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Songs");
  assertStringIncludes(html, "bottom-nav");
});

Deno.test("GET / shows song rows when songs exist", async () => {
  const { app, db } = testApp();
  db.songs.create({ title: "Pink Moon", artist: "Nick Drake" });
  const res = await app.request("/");
  const html = await res.text();
  assertStringIncludes(html, "Pink Moon");
  assertStringIncludes(html, "Nick Drake");
});

Deno.test("GET /songs/:id returns 404 for unknown id", async () => {
  const { app } = testApp();
  const res = await app.request("/songs/nonexistent-id");
  assertEquals(res.status, 404);
});

Deno.test("GET /songs/:id returns song detail page", async () => {
  const { app, db } = testApp();
  const song = db.songs.create({ title: "Norwegian Wood", artist: "The Beatles", songKey: "E" });
  const res = await app.request(`/songs/${song.id}`);
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Norwegian Wood");
  assertStringIncludes(html, "The Beatles");
});

Deno.test("GET /songs/:id shows sheets", async () => {
  const { app, db } = testApp();
  const song = db.songs.create({ title: "Test Song", artist: "Test" });
  db.sheets.create({ songId: song.id, sheetType: "lyrics", body: "La la la" });
  const res = await app.request(`/songs/${song.id}`);
  const html = await res.text();
  assertStringIncludes(html, "Lyrics");
  assertStringIncludes(html, "La la la");
});

Deno.test("song detail hides admin controls when unauthenticated", async () => {
  const { app, db } = testApp();
  const song = db.songs.create({ title: "Test", artist: "Artist" });
  db.sheets.create({ songId: song.id, sheetType: "lyrics", body: "La la la" });
  const res = await app.request(`/songs/${song.id}`);
  const html = await res.text();
  assertEquals(html.includes("Add sheet"), false);
  assertEquals(html.includes("Edit song"), false);
  assertEquals(html.includes("Edit Lyrics"), false);
});

Deno.test("GET /songs/:id/sheets/:sheetId/edit redirects to login when unauthenticated", async () => {
  const { app, db } = testApp();
  const song = db.songs.create({ title: "Test", artist: "A" });
  const sheet = db.sheets.create({ songId: song.id, sheetType: "lyrics", body: "..." });
  const res = await app.request(`/songs/${song.id}/sheets/${sheet.id}/edit`);
  assertEquals(res.status, 302);
  assertStringIncludes(res.headers.get("location") ?? "", "/login");
  assertStringIncludes(res.headers.get("location") ?? "", "next=");
});

Deno.test("GET /playlists/new redirects to login (not 404) when unauthenticated", async () => {
  const { app } = testApp();
  const res = await app.request("/playlists/new");
  assertEquals(res.status, 302);
  assertStringIncludes(res.headers.get("location") ?? "", "/login");
});

Deno.test("GET /playlists returns playlists page", async () => {
  const { app } = testApp();
  const res = await app.request("/playlists");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Playlists");
});

Deno.test("GET /playlists/:id returns playlist detail", async () => {
  const { app, db } = testApp();
  const pl = db.playlists.create("Campfire Songs");
  const res = await app.request(`/playlists/${pl.id}`);
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Campfire Songs");
});

Deno.test("GET /join returns session join page", async () => {
  const { app } = testApp();
  const res = await app.request("/join");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Session");
});

// ── Fragment routes ───────────────────────────────────────────────────────────

Deno.test("GET /fragments/songs returns song rows", async () => {
  const { app, db } = testApp();
  db.songs.create({ title: "Pink Moon", artist: "Nick Drake" });
  const res = await app.request("/fragments/songs");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "Pink Moon");
});

Deno.test("GET /fragments/songs?q= filters results", async () => {
  const { app, db } = testApp();
  db.songs.create({ title: "Pink Moon", artist: "Nick Drake" });
  db.songs.create({ title: "Norwegian Wood", artist: "The Beatles" });

  const res = await app.request("/fragments/songs?q=pink");
  const html = await res.text();
  assertStringIncludes(html, "Pink Moon");
  assertEquals(html.includes("Norwegian Wood"), false);
});

Deno.test("GET /fragments/songs?q= with no match returns empty hint", async () => {
  const { app } = testApp();
  const res = await app.request("/fragments/songs?q=zzznomatch");
  const html = await res.text();
  assertStringIncludes(html, "No songs matching");
});

Deno.test("GET /fragments/sessions/:code returns banner for active session", async () => {
  const { app, db } = testApp();
  db.sessions.create({ code: "FIRE", leaderToken: "token123" });
  const res = await app.request("/fragments/sessions/FIRE");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "session-banner");
});

Deno.test("GET /fragments/sessions/:code returns ended state", async () => {
  const { app, db } = testApp();
  db.sessions.create({ code: "DONE", leaderToken: "t" });
  db.sessions.end("DONE");
  const res = await app.request("/fragments/sessions/DONE");
  const html = await res.text();
  assertStringIncludes(html, "ended");
});

// ── Auth routes ───────────────────────────────────────────────────────────────

Deno.test("GET /login returns login page", async () => {
  const { app } = testApp();
  const res = await app.request("/login");
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "password");
});

Deno.test("GET /add-song redirects to login when unauthenticated", async () => {
  const { app } = testApp();
  const res = await app.request("/add-song");
  assertEquals(res.status, 302);
  assertStringIncludes(res.headers.get("location") ?? "", "/login");
  assertStringIncludes(res.headers.get("location") ?? "", "next=");
});

Deno.test("POST /login with wrong password redirects back to login", async () => {
  const { app } = testApp();
  const res = await app.request("/login", {
    method: "POST",
    body: new URLSearchParams({ password: "wrongpassword" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assertEquals(res.status, 302);
  const loc = res.headers.get("location") ?? "";
  assertStringIncludes(loc, "/login");
});

// ── Session routes ────────────────────────────────────────────────────────────

Deno.test("POST /join with invalid code redirects with error", async () => {
  const { app } = testApp();
  const res = await app.request("/join", {
    method: "POST",
    body: new URLSearchParams({ code: "XXXX" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assertEquals(res.status, 302);
  const loc = res.headers.get("location") ?? "";
  assertStringIncludes(loc, "error=notfound");
});

Deno.test("POST /join with valid code sets cookie and redirects", async () => {
  const { app, db } = testApp();
  db.sessions.create({ code: "FIRE", leaderToken: "tok" });
  const res = await app.request("/join", {
    method: "POST",
    body: new URLSearchParams({ code: "FIRE" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assertEquals(res.status, 302);
  const cookie = res.headers.get("set-cookie") ?? "";
  assertStringIncludes(cookie, "session_code=FIRE");
});

Deno.test("POST /sessions creates session and redirects", async () => {
  const { app } = testApp();
  const res = await app.request("/sessions", {
    method: "POST",
    body: new URLSearchParams({}),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  assertEquals(res.status, 302);
  const loc = res.headers.get("location") ?? "";
  assertStringIncludes(loc, "/join");
  const cookie = res.headers.get("set-cookie") ?? "";
  assertStringIncludes(cookie, "session_code");
});
