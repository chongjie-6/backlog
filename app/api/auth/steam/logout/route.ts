import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disconnect = forget the account. We persist only the signed id in the cookie,
// so clearing it removes everything we hold about the user.
function disconnect(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}

export async function GET(request: NextRequest) {
  return disconnect(request);
}

export async function POST(request: NextRequest) {
  return disconnect(request);
}
