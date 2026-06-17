// Connected-account session: a single HMAC-signed cookie holding the verified
// SteamID64. Signing prevents a client from forging another user's id. The key
// comes from CURATOR_SECRET (set one in production); dev falls back to a fixed
// insecure value.
//
// We deliberately persist nothing but the id in the cookie — the library and
// preferences are fetched/derived server-side, keeping stored PII minimal.
//
// Server-only.

import crypto from "node:crypto";

export const SESSION_COOKIE = "curator_steam";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.CURATOR_SECRET ?? "dev-insecure-secret-change-me";
}

export function signSteamId(steamId: string): string {
  const sig = crypto
    .createHmac("sha256", secret())
    .update(steamId)
    .digest("base64url");
  return `${steamId}.${sig}`;
}

/** Returns the SteamID64 if the cookie is intact and untampered, else null. */
export function verifySteamCookie(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!/^\d{17}$/.test(value)) return null;
  return value;
}

export function sessionCookieOptions(maxAge: number = MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
