import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySteamCookie } from "@/lib/server/session";
import { upsertSubscriber } from "@/lib/server/subscribers";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/curatorTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Subscribe the connected account to the daily digest. Requires a Steam session
// so we have a real library to curate from. Body: { email, prefs?, manualGenres? }.
export async function POST(request: NextRequest) {
  const steamId = verifySteamCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!steamId) {
    return NextResponse.json(
      { error: "Connect with Steam first.", code: "not_connected" },
      { status: 401 },
    );
  }

  let body: { email?: string; prefs?: Preferences; manualGenres?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const sub = await upsertSubscriber({
    steamId,
    email,
    prefs: body.prefs ?? DEFAULT_PREFERENCES,
    manualGenres: body.manualGenres,
  });

  return NextResponse.json({ ok: true, email: sub.email });
}

// Unsubscribe the connected account (data deletion).
export async function DELETE(request: NextRequest) {
  const steamId = verifySteamCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!steamId) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }
  const { removeSubscriber } = await import("@/lib/server/subscribers");
  const removed = await removeSubscriber(steamId);
  return NextResponse.json({ ok: true, removed });
}
