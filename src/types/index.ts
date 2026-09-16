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
  youtubeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sheet {
  id: string;
  songId: string;
  sheetType: SheetType;
  customLabel?: string;
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
  songCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistWithSongs extends Playlist {
  songs: Song[];
}

export interface JamSession {
  id: string;
  code: string;
  leaderToken: string;
  playlistId?: string;
  currentSongId?: string;
  currentSheetId?: string;
  status: "active" | "ended";
  updatedAt: string;
}

export const SHEET_TYPE_LABELS: Record<SheetType, string> = {
  lyrics: "Lyrics",
  lead_guitar: "Lead Guitar",
  rhythm_guitar: "Rhythm Guitar",
  bass: "Bass",
  drums: "Drums",
  keys: "Keys",
  vocals: "Vocals",
  other: "Other",
};
