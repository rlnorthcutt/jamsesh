const HTMX_URL = "https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js";
const ALPINE_URL = "https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js";

await Deno.mkdir("static", { recursive: true });

console.log("Downloading htmx + alpine…");
const [htmxRes, alpineRes] = await Promise.all([fetch(HTMX_URL), fetch(ALPINE_URL)]);
if (!htmxRes.ok) throw new Error(`Failed to fetch htmx: ${htmxRes.status}`);
if (!alpineRes.ok) throw new Error(`Failed to fetch alpine: ${alpineRes.status}`);
await Promise.all([
  Deno.writeFile("static/htmx.min.js", new Uint8Array(await htmxRes.arrayBuffer())),
  Deno.writeFile("static/alpine.min.js", new Uint8Array(await alpineRes.arrayBuffer())),
]);

console.log("Setup complete. Run: deno task dev");
