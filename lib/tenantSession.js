import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

// The app's first non-Clerk session: a stateless HMAC-signed cookie holding
// only the tenant's verified email + an expiry. No server-side session store
// (v1) — sign-out clears the cookie, the 30-day expiry bounds the rest.
// Requires TENANT_SESSION_SECRET (server-only; generate: openssl rand -hex 32).

const COOKIE_NAME = "atlas_tenant_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isTenantSessionConfigured() {
  return Boolean(process.env.TENANT_SESSION_SECRET);
}

const sign = (payload) =>
  crypto
    .createHmac("sha256", process.env.TENANT_SESSION_SECRET)
    .update(payload)
    .digest("base64url");

// Signed session value: base64url(JSON{email, exp}).signature
export function mintTenantSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + MAX_AGE_SECONDS * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Verifies signature (constant-time) + expiry. Any failure = no session.
export async function readTenantSession() {
  if (!isTenantSessionConfigured()) return null;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.email || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export async function setTenantSessionCookie(value) {
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearTenantSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
