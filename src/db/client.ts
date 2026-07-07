import { DatabaseSync } from "node:sqlite";
import type { Song, Sheet, Playlist, PlaylistWithSongs, JamSession, SheetType, Difficulty } from "../types/index.ts";

export type { Song, Sheet, Playlist, PlaylistWithSongs, JamSession };

type SQLVal = string | number | bigint | null | Uint8Array;

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v;
  }
  return out as T;
}

function parseSong(row: Record<string, unknown>): Song & { sheetCount: number } {
  const s = rowToCamel<Song & { sheetCount: number }>(row);
  s.tags = JSON.parse((row.tags as string) ?? "[]");
  return s;
}

export function initDb(dbPath?: string): DatabaseSync {
  const dir = Deno.env.get("SMALLWEB_DATA_DIR") ?? "./data";
  const path = dbPath ?? `${dir}/jamsesh.db`;
  if (!dbPath) {
    Deno.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  const schemaPath = new URL("./schema.sql", import.meta.url).pathname;
  db.exec(Deno.readTextFileSync(schemaPath));
  return db;
}

export type Db = ReturnType<typeof createDb>;

export function createDb(dbPath?: string) {
  const db = initDb(dbPath);

  const songs = {
    list(): (Song & { sheetCount: number })[] {
      return (db.prepare(`
        SELECT s.*, COUNT(sh.id) as sheet_count
        FROM songs s LEFT JOIN sheets sh ON sh.song_id = s.id
        GROUP BY s.id ORDER BY s.title COLLATE NOCASE
      `).all() as Record<string, unknown>[]).map(parseSong);
    },

    search(q: string): (Song & { sheetCount: number })[] {
      if (!q.trim()) return songs.list();
      const like = `%${q}%`;
      return (db.prepare(`
        SELECT s.*, COUNT(sh.id) as sheet_count
        FROM songs s LEFT JOIN sheets sh ON sh.song_id = s.id
        WHERE s.title LIKE ? OR s.artist LIKE ?
        GROUP BY s.id ORDER BY s.title COLLATE NOCASE
      `).all(like, like) as Record<string, unknown>[]).map(parseSong);
    },

    get(id: string): Song | undefined {
      const row = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return parseSong(row);
    },

    create(data: { title: string; artist: string; songKey?: string; tempo?: number; tags?: string[] }): Song {
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO songs (id, title, artist, song_key, tempo, tags) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, data.title, data.artist, data.songKey ?? null, data.tempo ?? null, JSON.stringify(data.tags ?? []));
      return songs.get(id)!;
    },

    update(id: string, data: Partial<Pick<Song, "title" | "artist" | "songKey" | "tempo" | "tags">>): Song | undefined {
      const sets: string[] = [];
      const vals: SQLVal[] = [];
      if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
      if (data.artist !== undefined) { sets.push("artist = ?"); vals.push(data.artist); }
      if (data.songKey !== undefined) { sets.push("song_key = ?"); vals.push(data.songKey); }
      if (data.tempo !== undefined) { sets.push("tempo = ?"); vals.push(data.tempo); }
      if (data.tags !== undefined) { sets.push("tags = ?"); vals.push(JSON.stringify(data.tags)); }
      if (!sets.length) return songs.get(id);
      sets.push("updated_at = datetime('now')");
      vals.push(id);
      db.prepare(`UPDATE songs SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return songs.get(id);
    },

    delete(id: string): void {
      db.prepare("DELETE FROM songs WHERE id = ?").run(id);
    },
  };

  const sheets = {
    forSong(songId: string): Sheet[] {
      return (db.prepare(
        "SELECT * FROM sheets WHERE song_id = ? ORDER BY created_at"
      ).all(songId) as Record<string, unknown>[]).map(r => rowToCamel<Sheet>(r));
    },

    get(id: string): Sheet | undefined {
      const row = db.prepare("SELECT * FROM sheets WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return rowToCamel<Sheet>(row);
    },

    create(data: {
      songId: string; sheetType: SheetType; body: string;
      customLabel?: string; versionLabel?: string; difficulty?: Difficulty;
      tuning?: string; capo?: number; authorName?: string;
    }): Sheet {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO sheets (id, song_id, sheet_type, custom_label, version_label, body, difficulty, tuning, capo, author_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.songId, data.sheetType, data.customLabel ?? null, data.versionLabel ?? null,
        data.body, data.difficulty ?? null, data.tuning ?? null, data.capo ?? null, data.authorName ?? null
      );
      return sheets.get(id)!;
    },

    update(id: string, data: Partial<Pick<Sheet, "sheetType" | "customLabel" | "body" | "versionLabel" | "difficulty" | "tuning" | "capo" | "authorName">>): Sheet | undefined {
      const sets: string[] = [];
      const vals: SQLVal[] = [];
      if (data.sheetType !== undefined) { sets.push("sheet_type = ?"); vals.push(data.sheetType); }
      if (data.customLabel !== undefined) { sets.push("custom_label = ?"); vals.push(data.customLabel); }
      if (data.body !== undefined) { sets.push("body = ?"); vals.push(data.body); }
      if (data.versionLabel !== undefined) { sets.push("version_label = ?"); vals.push(data.versionLabel); }
      if (data.difficulty !== undefined) { sets.push("difficulty = ?"); vals.push(data.difficulty); }
      if (data.tuning !== undefined) { sets.push("tuning = ?"); vals.push(data.tuning); }
      if (data.capo !== undefined) { sets.push("capo = ?"); vals.push(data.capo); }
      if (data.authorName !== undefined) { sets.push("author_name = ?"); vals.push(data.authorName); }
      if (!sets.length) return sheets.get(id);
      sets.push("updated_at = datetime('now')");
      vals.push(id);
      db.prepare(`UPDATE sheets SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return sheets.get(id);
    },

    delete(id: string): void {
      db.prepare("DELETE FROM sheets WHERE id = ?").run(id);
    },
  };

  const playlists = {
    list(): (Playlist & { songCount: number })[] {
      return (db.prepare(`
        SELECT p.*, COUNT(ps.song_id) as song_count
        FROM playlists p LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        GROUP BY p.id ORDER BY p.name COLLATE NOCASE
      `).all() as Record<string, unknown>[]).map(r => rowToCamel<Playlist & { songCount: number }>(r));
    },

    get(id: string): PlaylistWithSongs | undefined {
      const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const playlist = rowToCamel<Playlist>(row);
      const songRows = db.prepare(`
        SELECT s.* FROM songs s
        JOIN playlist_songs ps ON ps.song_id = s.id
        WHERE ps.playlist_id = ? ORDER BY ps.position
      `).all(id) as Record<string, unknown>[];
      const songList = songRows.map(r => parseSong(r));
      return { ...playlist, songCount: songList.length, songs: songList };
    },

    create(name: string): Playlist {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO playlists (id, name) VALUES (?, ?)").run(id, name);
      const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as Record<string, unknown>;
      return { ...rowToCamel<Playlist>(row), songCount: 0 };
    },

    update(id: string, name: string): void {
      db.prepare("UPDATE playlists SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
    },

    delete(id: string): void {
      db.prepare("DELETE FROM playlists WHERE id = ?").run(id);
    },

    addSong(playlistId: string, songId: string): void {
      const row = db.prepare(
        "SELECT MAX(position) as m FROM playlist_songs WHERE playlist_id = ?"
      ).get(playlistId) as { m: number | null };
      db.prepare(
        "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)"
      ).run(playlistId, songId, (row.m ?? -1) + 1);
    },

    removeSong(playlistId: string, songId: string): void {
      db.prepare("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?").run(playlistId, songId);
    },

    reorder(playlistId: string, orderedSongIds: string[]): void {
      const del = db.prepare("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?");
      const ins = db.prepare("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)");
      orderedSongIds.forEach((songId, i) => {
        del.run(playlistId, songId);
        ins.run(playlistId, songId, i);
      });
    },
  };

  const sessions = {
    getByCode(code: string): JamSession | undefined {
      const row = db.prepare(
        "SELECT * FROM sessions WHERE code = ?"
      ).get(code.toUpperCase()) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return rowToCamel<JamSession>(row);
    },

    create(opts: { code: string; leaderToken: string; playlistId?: string; currentSongId?: string }): JamSession {
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO sessions (id, code, leader_token, playlist_id, current_song_id) VALUES (?, ?, ?, ?, ?)"
      ).run(id, opts.code, opts.leaderToken, opts.playlistId ?? null, opts.currentSongId ?? null);
      return sessions.getByCode(opts.code)!;
    },

    advance(code: string, songId: string, sheetId?: string): void {
      db.prepare(`
        UPDATE sessions SET current_song_id = ?, current_sheet_id = ?, updated_at = datetime('now') WHERE code = ?
      `).run(songId, sheetId ?? null, code.toUpperCase());
    },

    end(code: string): void {
      db.prepare(
        "UPDATE sessions SET status = 'ended', updated_at = datetime('now') WHERE code = ?"
      ).run(code.toUpperCase());
    },
  };

  return { songs, sheets, playlists, sessions, _db: db };
}
