CREATE TABLE IF NOT EXISTS songs (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  song_key    TEXT,
  tempo       INTEGER,
  tags        TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sheets (
  id            TEXT PRIMARY KEY,
  song_id       TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sheet_type    TEXT NOT NULL,
  custom_label  TEXT,
  version_label TEXT,
  body          TEXT NOT NULL,
  difficulty    TEXT,
  tuning        TEXT,
  capo          INTEGER,
  author_name   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  leader_token      TEXT NOT NULL,
  playlist_id       TEXT REFERENCES playlists(id) ON DELETE SET NULL,
  current_song_id   TEXT REFERENCES songs(id) ON DELETE SET NULL,
  current_sheet_id  TEXT REFERENCES sheets(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sheets_song_id ON sheets(song_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
