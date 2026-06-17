import { type NextRequest, NextResponse } from "next/server";
import { removeSubscriber, verifyUnsubscribeToken } from "@/lib/server/subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click unsubscribe link for emails. Token is HMAC(steamId), so no login
// needed and the link can't be guessed.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const steamId = sp.get("steamId") ?? "";
  const token = sp.get("token") ?? "";

  if (!steamId || !token || !verifyUnsubscribeToken(steamId, token)) {
    return new NextResponse(page("Invalid or expired unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  await removeSubscriber(steamId);
  return new NextResponse(
    page("You've been unsubscribed and your saved data was deleted."),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function page(message: string): string {
  return `<!doctype html><html><body style="background:#0a0a0a;color:#e4e4e7;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <div style="text-align:center;max-width:420px;padding:24px">
      <h1 style="color:#22d3ee;font-size:20px">Game Deal Curator</h1>
      <p style="color:#a1a1aa">${message}</p>
      <a href="/" style="color:#22d3ee">Back to the app</a>
    </div></body></html>`;
}
