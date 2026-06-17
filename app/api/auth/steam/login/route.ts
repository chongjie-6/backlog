import { type NextRequest, NextResponse } from "next/server";
import { buildSteamLoginUrl } from "@/lib/server/openid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const returnTo = `${origin}/api/auth/steam/callback`;
  return NextResponse.redirect(buildSteamLoginUrl(returnTo, origin));
}
