import { type NextRequest, NextResponse } from "next/server";
import { verifyOpenIdCallback } from "@/lib/server/openid";
import { SESSION_COOKIE, signSteamId, sessionCookieOptions } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const steamId = await verifyOpenIdCallback(request.nextUrl.searchParams);
  const dest = new URL("/", request.nextUrl.origin);

  if (!steamId) {
    dest.searchParams.set("auth", "failed");
    return NextResponse.redirect(dest);
  }

  dest.searchParams.set("auth", "connected");
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, signSteamId(steamId), sessionCookieOptions());
  return res;
}
