import type { Playlist } from "../types/index.ts";

interface PlaylistCardProps {
  playlist: Playlist & { songCount: number };
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const songLabel = playlist.songCount === 1 ? "1 song" : `${playlist.songCount} songs`;
  return (
    <a href={`/playlists/${playlist.id}`} class="pl-card">
      <div class="pl-thumb" aria-hidden="true">
        <div class="pl-thumb-color" style={`background:${hashColor(playlist.id, 0)}`} />
        <div class="pl-thumb-color" style={`background:${hashColor(playlist.id, 1)}`} />
      </div>
      <div class="pl-main">
        <b>{playlist.name}</b>
        <span>{songLabel}</span>
      </div>
    </a>
  );
}

function hashColor(id: string, offset: number): string {
  let hash = offset * 997;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffff;
  const h = (hash % 360 + 360) % 360;
  const s = 40 + (hash % 30);
  const l = 35 + (hash % 20);
  return `hsl(${h},${s}%,${l}%)`;
}
