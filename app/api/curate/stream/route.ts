import { type NextRequest } from "next/server";
import { curate } from "@/lib/server/curate";
import { enrichLows } from "@/lib/server/historicalLow";
import { resolveLibrary } from "@/lib/server/resolveLibrary";
import {
  parseCurateRequest,
  buildCuratePayload,
  MAX_RESULTS,
} from "@/lib/server/curateRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Server-Sent Events variant of /api/curate. Streams enrichment progress so the
// UI shows a real bar for large libraries instead of blocking. Event names are
// distinct from EventSource's built-in "error" to avoid collisions:
//   stage    { stage }
//   progress { total, done, cached, fetched }
//   result   <curate payload>
//   failed   { error, code? }
export async function GET(request: NextRequest) {
  const { demo, manualGenres, options } = parseCurateRequest(request.nextUrl.searchParams);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        const lib = await resolveLibrary(request, { demo, manualGenres });
        if (!lib.ok) {
          send("failed", { error: lib.error, code: lib.code });
          return close();
        }

        send("stage", { stage: "deals" });
        const result = await curate({
          owned: lib.owned,
          manualGenres,
          ...options,
          onProgress: (p) => send("progress", p),
          signal: request.signal,
        });

        send("stage", { stage: "pricing" });
        const top = result.results.slice(0, MAX_RESULTS);
        const lows = await enrichLows(top.map((s) => s.deal.gameID));

        send("result", buildCuratePayload(result, lows));
        close();
      } catch (e) {
        send("failed", { error: e instanceof Error ? e.message : "Curation failed" });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
