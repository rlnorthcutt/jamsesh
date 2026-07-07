import { assertEquals, assertExists, assertNotEquals } from "jsr:@std/assert";
import { createDb } from "../src/db/client.ts";

function testDb() {
  return createDb(":memory:");
}

// ── Songs ────────────────────────────────────────────────────────────────────

Deno.test("songs: create and retrieve", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Pink Moon", artist: "Nick Drake", songKey: "C", tags: ["campfire"] });

  assertExists(song.id);
  assertEquals(song.title, "Pink Moon");
  assertEquals(song.artist, "Nick Drake");
  assertEquals(song.songKey, "C");
  assertEquals(song.tags, ["campfire"]);
});

Deno.test("songs: list returns all songs ordered by title", () => {
  const db = testDb();
  db.songs.create({ title: "Zebra", artist: "A" });
  db.songs.create({ title: "Apple", artist: "B" });

  const list = db.songs.list();
  assertEquals(list[0].title, "Apple");
  assertEquals(list[1].title, "Zebra");
});

Deno.test("songs: search filters by title and artist", () => {
  const db = testDb();
  db.songs.create({ title: "Pink Moon", artist: "Nick Drake" });
  db.songs.create({ title: "Norwegian Wood", artist: "The Beatles" });

  const byTitle = db.songs.search("pink");
  assertEquals(byTitle.length, 1);
  assertEquals(byTitle[0].title, "Pink Moon");

  const byArtist = db.songs.search("beatles");
  assertEquals(byArtist.length, 1);
  assertEquals(byArtist[0].title, "Norwegian Wood");

  const empty = db.songs.search("zzz");
  assertEquals(empty.length, 0);
});

Deno.test("songs: update fields", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Old Title", artist: "Old Artist" });
  const updated = db.songs.update(song.id, { title: "New Title", songKey: "Am" });

  assertEquals(updated?.title, "New Title");
  assertEquals(updated?.artist, "Old Artist");
  assertEquals(updated?.songKey, "Am");
});

Deno.test("songs: delete removes song", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Delete Me", artist: "Test" });
  db.songs.delete(song.id);
  assertEquals(db.songs.get(song.id), undefined);
});

Deno.test("songs: list includes sheet count", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Song", artist: "Artist" });
  assertEquals(db.songs.list()[0].sheetCount, 0);

  db.sheets.create({ songId: song.id, sheetType: "lyrics", body: "La la la" });
  assertEquals(db.songs.list()[0].sheetCount, 1);
});

// ── Sheets ───────────────────────────────────────────────────────────────────

Deno.test("sheets: create and retrieve for a song", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Test", artist: "Test" });
  const sheet = db.sheets.create({
    songId: song.id,
    sheetType: "lead_guitar",
    body: "C  G  Am  F",
    tuning: "Standard",
    capo: 2,
    authorName: "Ron",
  });

  assertExists(sheet.id);
  assertEquals(sheet.songId, song.id);
  assertEquals(sheet.sheetType, "lead_guitar");
  assertEquals(sheet.tuning, "Standard");
  assertEquals(sheet.capo, 2);
  assertEquals(sheet.authorName, "Ron");

  const all = db.sheets.forSong(song.id);
  assertEquals(all.length, 1);
  assertEquals(all[0].id, sheet.id);
});

Deno.test("sheets: delete cascades when song deleted", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Cascade", artist: "Test" });
  db.sheets.create({ songId: song.id, sheetType: "lyrics", body: "..." });

  db.songs.delete(song.id);
  assertEquals(db.sheets.forSong(song.id).length, 0);
});

// ── Playlists ─────────────────────────────────────────────────────────────────

Deno.test("playlists: create, list, update, delete", () => {
  const db = testDb();
  const pl = db.playlists.create("Campfire Songs");
  assertExists(pl.id);
  assertEquals(pl.name, "Campfire Songs");
  assertEquals(pl.songCount, 0);

  db.playlists.update(pl.id, "Bonfire Songs");
  const list = db.playlists.list();
  assertEquals(list[0].name, "Bonfire Songs");

  db.playlists.delete(pl.id);
  assertEquals(db.playlists.list().length, 0);
});

Deno.test("playlists: add and remove songs maintains order", () => {
  const db = testDb();
  const pl = db.playlists.create("Test");
  const s1 = db.songs.create({ title: "A", artist: "X" });
  const s2 = db.songs.create({ title: "B", artist: "X" });
  const s3 = db.songs.create({ title: "C", artist: "X" });

  db.playlists.addSong(pl.id, s1.id);
  db.playlists.addSong(pl.id, s2.id);
  db.playlists.addSong(pl.id, s3.id);

  const withSongs = db.playlists.get(pl.id)!;
  assertEquals(withSongs.songs.map((s) => s.id), [s1.id, s2.id, s3.id]);

  db.playlists.removeSong(pl.id, s2.id);
  const after = db.playlists.get(pl.id)!;
  assertEquals(after.songs.map((s) => s.id), [s1.id, s3.id]);
});

Deno.test("playlists: reorder songs", () => {
  const db = testDb();
  const pl = db.playlists.create("Test");
  const s1 = db.songs.create({ title: "A", artist: "X" });
  const s2 = db.songs.create({ title: "B", artist: "X" });
  const s3 = db.songs.create({ title: "C", artist: "X" });

  db.playlists.addSong(pl.id, s1.id);
  db.playlists.addSong(pl.id, s2.id);
  db.playlists.addSong(pl.id, s3.id);

  db.playlists.reorder(pl.id, [s3.id, s1.id, s2.id]);
  const after = db.playlists.get(pl.id)!;
  assertEquals(after.songs.map((s) => s.id), [s3.id, s1.id, s2.id]);
});

// ── Sessions ──────────────────────────────────────────────────────────────────

Deno.test("sessions: create, retrieve, advance, end", () => {
  const db = testDb();
  const song = db.songs.create({ title: "Song", artist: "Artist" });
  const session = db.sessions.create({ code: "TEST", leaderToken: "abc123" });

  assertExists(session.id);
  assertEquals(session.code, "TEST");
  assertEquals(session.status, "active");

  db.sessions.advance("TEST", song.id);
  const updated = db.sessions.getByCode("TEST")!;
  assertEquals(updated.currentSongId, song.id);

  db.sessions.end("TEST");
  const ended = db.sessions.getByCode("TEST")!;
  assertEquals(ended.status, "ended");
});

Deno.test("sessions: getByCode is case-insensitive", () => {
  const db = testDb();
  db.sessions.create({ code: "FIRE", leaderToken: "token" });
  assertExists(db.sessions.getByCode("fire"));
  assertExists(db.sessions.getByCode("FIRE"));
});

Deno.test("sessions: returns undefined for nonexistent code", () => {
  const db = testDb();
  assertEquals(db.sessions.getByCode("XXXX"), undefined);
});
