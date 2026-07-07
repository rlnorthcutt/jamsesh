import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { createDb } from "./src/db/client.ts";
import { pageRoutes } from "./src/routes/pages.tsx";
import { fragmentRoutes } from "./src/routes/fragments.tsx";
import { sessionRoutes } from "./src/routes/sessions.ts";
import { authRoutes } from "./src/routes/auth.tsx";

const db = createDb();

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./" }));

app.route("/", pageRoutes(db));
app.route("/", fragmentRoutes(db));
app.route("/", sessionRoutes(db));
app.route("/", authRoutes(db));

app.notFound((c) => c.text("Not found", 404));

// Export for Smallweb (which runs main.ts with `deno serve`)
export default { fetch: app.fetch };

// Also start directly when invoked with `deno run` (local dev via `deno task dev`)
if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  console.log(`jamsesh running on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
