interface SessionBannerProps {
  code: string;
  playlistName?: string;
  currentSongTitle?: string;
  currentSongArtist?: string;
  currentSongId?: string;
}

export function SessionBanner({ code, playlistName, currentSongTitle, currentSongArtist, currentSongId }: SessionBannerProps) {
  const href = currentSongId ? `/songs/${currentSongId}` : `/join?code=${code}`;
  return (
    <div
      id="session-banner-wrap"
      class="session-banner-wrap"
      hx-get={`/fragments/sessions/${code}`}
      hx-trigger="every 4s"
      hx-swap="outerHTML"
    >
      <a href={href} class="session-banner">
        <div class="pulse-dot" />
        <div class="session-banner-text">
          <b>Live session{playlistName ? ` · ${playlistName}` : ""}</b>
          {currentSongTitle
            ? `Leader is on "${currentSongTitle}"${currentSongArtist ? ` — ${currentSongArtist}` : ""}`
            : "Waiting for leader to start…"}
        </div>
        <div class="session-jump">Jump →</div>
      </a>
    </div>
  );
}

export function SessionBannerEnded({ code }: { code: string }) {
  return (
    <div id="session-banner-wrap" class="session-banner-wrap">
      <div class="session-banner session-banner--ended">
        <div class="session-banner-text">
          <b>Session {code} ended</b>
        </div>
      </div>
    </div>
  );
}
