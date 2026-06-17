import { type NextRequest, NextResponse } from "next/server";
import { curate } from "@/lib/server/curate";
import { demoLibrary } from "@/lib/server/demoLibrary";
import { toCuratedDeals } from "@/lib/server/curateView";
import { enrichLows } from "@/lib/server/historicalLow";
import { buildDigest } from "@/lib/server/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Render the digest email so you can eyeball it. `?format=text` returns the
// plaintext part; default returns the HTML body.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const format = sp.get("format");

  const { profile, results } = await curate({ owned: demoLibrary });
  const top = results.slice(0, 6);
  const lows = await enrichLows(top.map((s) => s.deal.gameID));
  const email = buildDigest({
    recipientName: "Demo Player",
    topGenres: profile.topGenres,
    deals: toCuratedDeals(results, 6, lows),
    manageUrl: `${request.nextUrl.origin}/`,
  });

  if (format === "text") {
    return new NextResponse(email.text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "json") {
    return NextResponse.json({ subject: email.subject });
  }
  return new NextResponse(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
