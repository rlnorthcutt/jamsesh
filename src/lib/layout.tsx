import type { Child } from "hono/jsx";

interface LayoutProps {
  title?: string;
  activeNav?: "songs" | "playlists" | "session";
  sessionCode?: string;
  children?: Child;
}

export function Layout({ title, activeNav, sessionCode, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title ? `${title} — jamsesh` : "jamsesh"}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js"></script>
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
          <main class="page-content">{children}</main>
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
        </div>
      </body>
    </html>
  );
}

// deno-lint-ignore no-explicit-any
export function page(el: any): string {
  return `<!DOCTYPE html>${String(el)}`;
}
