/** Extracts the video ID from common YouTube URL formats, or null if it can't be parsed. */
export function extractYouTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return u.pathname.slice(1).split("/")[0] || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const match = u.pathname.match(/^\/(embed|shorts)\/([^/?]+)/);
    if (match) return match[2];
  }

  return null;
}
