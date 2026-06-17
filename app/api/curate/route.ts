import { type NextRequest, NextResponse } from "next/server";
import { curate } from "@/lib/server/curate";
import { enrichLows } from "@/lib/server/historicalLow";
import { resolveLibrary } from "@/lib/server/resolveLibrary";
import {
  parseCurateRequest,
  buildCuratePayload,
  MAX_RESULTS,
} from "@/lib/server/curateRequest";

// Uses node:fs for the cache and runs live network calls — keep it on the Node
// runtime and request-time only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { demo, manualGenres, options } = parseCurateRequest(request.nextUrl.searchParams);

  const lib = await resolveLibrary(request, { demo, manualGenres });
  if (!lib.ok) {
    return NextResponse.json({ error: lib.error, code: lib.code }, { status: lib.status });
  }

  try {
    const result = await curate({ owned: lib.owned, manualGenres, ...options });
    const top = result.results.slice(0, MAX_RESULTS);
    const lows = await enrichLows(top.map((s) => s.deal.gameID));
    return NextResponse.json(buildCuratePayload(result, lows));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Curation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
