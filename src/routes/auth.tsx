import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireAuth, setAuthCookie, clearAuthCookie, getPassword } from "../lib/auth.ts";
import { Layout, page } from "../lib/layout.tsx";
import type { Db } from "../db/client.ts";

export function authRoutes(db: Db) {
  const app = new Hono();

  app.get("/login", (c) => {
    const sessionCode = getCookie(c, "session_code");
    const error = c.req.query("error");
    const next = c.req.query("next") ?? "";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
    const formAction = safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login";
    return c.html(page(
      <Layout title="Login" sessionCode={sessionCode}>
        <div class="song-detail-header">
          <a href={safeNext || "/"} class="back-row">← Back</a>
          <h2 style="font-family:var(--font-display); font-size:20px; margin:0 0 4px;">Contributor login</h2>
          <p style="font-size:13px; color:var(--text-dim); margin:0 0 20px;">
            Enter the shared password to add or edit songs.
          </p>
        </div>
        <div class="form-wrap">
          {error && (
            <div class="error-banner">Wrong password. Try again.</div>
          )}
          <form method="post" action={formAction}>
            <div class="field">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                autocomplete="current-password"
                autofocus
              />
            </div>
            <button type="submit" class="primary-btn">Sign in</button>
          </form>
        </div>
      </Layout>
    ));
  });

  app.post("/login", async (c) => {
    const form = await c.req.formData();
    const password = form.get("password");
    if (password !== getPassword()) {
      return c.redirect("/login?error=1");
    }
    await setAuthCookie(c);
    const rawNext = c.req.query("next") ?? "";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    return c.redirect(next);
  });

  app.post("/logout", requireAuth, (c) => {
    clearAuthCookie(c);
    return c.redirect("/");
  });

  return app;
}
