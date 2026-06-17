import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySteamCookie } from "@/lib/server/session";
import { getPlayerSummary } from "@/lib/server/steam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connection status for the UI: are we connected, and is the server key set? */
export async function GET(request: NextRequest) {
  const steamConfigured = Boolean(process.env.STEAM_API_KEY);
  const steamId = verifySteamCookie(request.cookies.get(SESSION_COOKIE)?.value);

  if (!steamId) {
    return NextResponse.json({ connected: false, steamConfigured });
  }

  let player = null;
  if (steamConfigured) {
    try {
      player = await getPlayerSummary(steamId);
    } catch {
      // Non-fatal — we still know they're connected.
    }
  }

  return NextResponse.json({ connected: true, steamId, player, steamConfigured });
}
