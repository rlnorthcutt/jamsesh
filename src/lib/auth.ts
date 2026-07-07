import { getSignedCookie, setSignedCookie, deleteCookie } from "hono/cookie";
import type { Context, Next } from "hono";

const AUTH_COOKIE = "jamsesh_auth";

function cookieSecret(): string {
  return Deno.env.get("JAMSESH_COOKIE_SECRET") ?? "dev-cookie-secret-change-me";
}

export function getPassword(): string {
  return Deno.env.get("JAMSESH_PASSWORD") ?? "campfire";
}

export async function isAuthenticated(c: Context): Promise<boolean> {
  return (await getSignedCookie(c, cookieSecret(), AUTH_COOKIE)) === "1";
}

export async function requireAuth(c: Context, next: Next) {
  const val = await getSignedCookie(c, cookieSecret(), AUTH_COOKIE);
  if (val !== "1") {
    if (c.req.header("HX-Request") === "true") {
      c.res.headers.set("HX-Redirect", "/login");
      return c.text("", 200);
    }
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }
  await next();
}

export async function setAuthCookie(c: Context): Promise<void> {
  await setSignedCookie(c, AUTH_COOKIE, "1", cookieSecret(), {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(c: Context): void {
  deleteCookie(c, AUTH_COOKIE);
}
