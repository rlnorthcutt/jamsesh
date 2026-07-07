import type { Song } from "../types/index.ts";

interface SongRowProps {
  song: Song & { sheetCount: number };
  highlight?: boolean;
}

export function SongRow({ song, highlight }: SongRowProps) {
  const sheetLabel = song.sheetCount === 1 ? "1 sheet" : `${song.sheetCount} sheets`;
  return (
    <a href={`/songs/${song.id}`} class={`row${highlight ? " row--highlight" : ""}`}>
      <div class="thumb" aria-hidden="true">♪</div>
      <div class="row-main">
        <div class="row-title">{song.title}</div>
        <div class="row-sub">{song.artist}</div>
      </div>
      <div class="badge">{sheetLabel}</div>
    </a>
  );
}
