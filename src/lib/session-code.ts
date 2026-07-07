const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion

export function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

export function generateLeaderToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
