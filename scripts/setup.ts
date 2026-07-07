const HTMX_URL = "https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js";

await Deno.mkdir("static", { recursive: true });

console.log("Downloading htmx…");
const res = await fetch(HTMX_URL);
if (!res.ok) throw new Error(`Failed to fetch htmx: ${res.status}`);
await Deno.writeFile("static/htmx.min.js", new Uint8Array(await res.arrayBuffer()));

console.log("Setup complete. Run: deno task dev");
