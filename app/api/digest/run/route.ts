import { type NextRequest, NextResponse } from "next/server";
import { curate } from "@/lib/server/curate";
import { demoLibrary } from "@/lib/server/demoLibrary";
import { toCuratedDeals } from "@/lib/server/curateView";
import { enrichLows } from "@/lib/server/historicalLow";
import { buildDigest } from "@/lib/server/digest";
import { sendEmail } from "@/lib/server/mailer";
import {
  listSubscribers,
  unsubscribeToken,
  type Subscriber,
} from "@/lib/server/subscribers";
import {
  getOwnedGames,
  SteamPrivateProfileError,
} from "@/lib/server/steam";
import type { Preferences } from "@/lib/curatorTypes";
import type { OwnedGame } from "@/lib/server/taste";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron entrypoint (see vercel.json). Authorized by CRON_SECRET; Vercel Cron
// sends it as a Bearer token automatically. When unset, only runs in dev.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return (
    header === `Bearer ${secret}` ||
    request.nextUrl.searchParams.get("key") === secret
  );
}

function prefsToCurate(p: Preferences) {
  return {
    maxPrice: p.maxPrice || undefined,
    minDiscount: p.minDiscount || undefined,
    minScore: p.minScore || undefined,
    excludeGenres: p.exclude.length ? p.exclude : undefined,
    preferGenres: p.prefer.length ? p.prefer : undefined,
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await listSubscribers();
  const origin = request.nextUrl.origin;
  const summary = { processed: 0, sent: 0, previewed: 0, skipped: 0, errors: 0 };
  const details: Record<string, string> = {};

  for (const sub of subscribers) {
    summary.processed++;
    try {
      const outcome = await deliver(sub, origin);
      details[sub.steamId] = outcome;
      if (outcome === "sent") summary.sent++;
      else if (outcome === "previewed") summary.previewed++;
      else summary.skipped++;
    } catch (e) {
      summary.errors++;
      details[sub.steamId] = e instanceof Error ? e.message : "error";
    }
  }

  return NextResponse.json({ summary, details });
}

async function deliver(sub: Subscriber, origin: string): Promise<string> {
  let owned: OwnedGame[] = [];
  const manualGenres = sub.manualGenres;

  if (sub.steamId === "demo") {
    owned = demoLibrary;
  } else {
    try {
      owned = await getOwnedGames(sub.steamId);
    } catch (e) {
      if (e instanceof SteamPrivateProfileError) {
        if (!manualGenres?.length) return "skipped:private_no_fallback";
      } else {
        throw e;
      }
    }
  }

  const { profile, results } = await curate({
    owned,
    manualGenres,
    ...prefsToCurate(sub.prefs),
  });
  if (results.length === 0) return "skipped:no_matches";

  const top = results.slice(0, 6);
  const lows = await enrichLows(top.map((s) => s.deal.gameID));
  const manageUrl = `${origin}/api/digest/unsubscribe?steamId=${sub.steamId}&token=${unsubscribeToken(sub.steamId)}`;
  const email = buildDigest({
    topGenres: profile.topGenres,
    deals: toCuratedDeals(results, 6, lows),
    manageUrl,
  });

  const result = await sendEmail({ to: sub.email, ...email });
  if (result.sent) return "sent";
  if (result.provider === "preview") return "previewed";
  return `skipped:${result.error ?? "send_failed"}`;
}
