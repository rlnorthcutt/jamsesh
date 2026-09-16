import type { Child } from "hono/jsx";

// Cache-busts static assets on every process restart (i.e. every deploy) so a
// CDN or browser holding a stale cached copy of app.js/styles.css doesn't
// silently keep serving old code after we ship a fix.
export const ASSET_VERSION = String(Date.now());

interface LayoutProps {
  title?: string;
  activeNav?: "songs" | "playlists" | "session";
  sessionCode?: string;
  /** Hides the bottom tab-bar nav — used for the focused sheet-reading view. */
  hideNav?: boolean;
  /** Fixed bottom bar rendered in place of the nav (e.g. the auto-scroll controls). */
  footer?: Child;
  /** Loads Alpine.js + the app's small client-state components (auto-scroll, YouTube audio toggle). */
  alpine?: boolean;
  children?: Child;
}

export function Layout({ title, activeNav, sessionCode, hideNav, footer, alpine, children }: LayoutProps) {
  const contentClass = [
    "page-content",
    hideNav && "page-content--no-nav",
    footer && "page-content--footer",
  ].filter(Boolean).join(" ");

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title ? `${title} — jamsesh` : "jamsesh"}</title>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23E85D2C'/%3E%3Ctext x='16' y='23' font-family='sans-serif' font-size='19' font-weight='700' fill='white' text-anchor='middle'%3E♪%3C/text%3E%3C/svg%3E"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href={`/static/styles.css?v=${ASSET_VERSION}`} />
        <script src={`/static/htmx.min.js?v=${ASSET_VERSION}`}></script>
      </head>
      <body>
        <div class="app-shell">
          {sessionCode && (
            <div
              id="session-banner-wrap"
              hx-get={`/fragments/sessions/${sessionCode}`}
              hx-trigger="every 4s"
              hx-swap="outerHTML"
            >
              <div class="session-banner-loading" />
            </div>
          )}
          <main class={contentClass}>{children}</main>
          {footer}
          {!hideNav && (
            <nav class="bottom-nav">
              <a href="/" class={`nav-item${activeNav === "songs" ? " active" : ""}`}>
                <span class="nav-icon">♪</span>
                Songs
              </a>
              <a href="/playlists" class={`nav-item${activeNav === "playlists" ? " active" : ""}`}>
                <span class="nav-icon">≡</span>
                Playlists
              </a>
              <a href="/join" class={`nav-item${activeNav === "session" ? " active" : ""}`}>
                <span class="nav-icon">⦿</span>
                Session
              </a>
            </nav>
          )}
        </div>
        {alpine && <script src={`/static/alpine.min.js?v=${ASSET_VERSION}`} defer></script>}
      </body>
    </html>
  );
}

// deno-lint-ignore no-explicit-any
export function page(el: any): string {
  return `<!DOCTYPE html>${String(el)}`;
}
