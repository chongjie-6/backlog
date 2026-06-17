// Shared parsing + response shaping for the curate endpoints (JSON + SSE).
//
// Server-only.

import { toCuratedDeals } from "./curateView";
import type { CurateResult } from "./curate";
import type { GameLow } from "./historicalLow";

export const MAX_RESULTS = 48;

export interface ParsedCurateRequest {
  demo: boolean;
  manualGenres?: string[];
  /** options passed straight to curate() (minus owned/manualGenres) */
  options: {
    minScore?: number;
    maxPrice?: string;
    minDiscount?: number;
    excludeGenres?: string[];
    preferGenres?: string[];
  };
}

export function parseCurateRequest(sp: URLSearchParams): ParsedCurateRequest {
  const csv = (key: string) =>
    sp.get(key)?.split(",").map((s) => s.trim()).filter(Boolean);

  return {
    demo: sp.get("demo") === "1" || sp.has("demo"),
    manualGenres: csv("genres"),
    options: {
      minScore: sp.get("minScore") ? Number(sp.get("minScore")) : undefined,
      maxPrice: sp.get("maxPrice") || undefined,
      minDiscount: sp.get("minDiscount") ? Number(sp.get("minDiscount")) : undefined,
      excludeGenres: csv("exclude"),
      preferGenres: csv("prefer"),
    },
  };
}

export function buildCuratePayload(result: CurateResult, lows: Map<string, GameLow>) {
  const top = result.results.slice(0, MAX_RESULTS);
  return {
    profile: {
      topGenres: result.profile.topGenres.slice(0, 10),
      gamesAnalyzed: result.profile.gamesAnalyzed,
    },
    meta: {
      dealsConsidered: result.dealsConsidered,
      ownedCount: result.ownedCount,
      usedFallback: result.usedFallback,
      returned: top.length,
    },
    results: toCuratedDeals(result.results, MAX_RESULTS, lows),
  };
}
