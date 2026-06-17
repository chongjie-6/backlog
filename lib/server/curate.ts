// The curation pipeline: library → enriched genres → taste profile → ranked,
// owned-excluded deals. This is the heart of the product (the "leanest POC").
//
// Server-only.

import { getDealPool } from "@/lib/cheapshark";
import { enrichLibrary, type EnrichProgress } from "./enrich";
import {
  buildTasteProfile,
  profileFromGenres,
  type OwnedGame,
  type TasteProfile,
} from "./taste";
import { scoreDeals, type ScoredDeal } from "./match";

export interface CurateInput {
  /** Owned games with playtime. Empty when using the manual-genre fallback. */
  owned: OwnedGame[];
  /** Private-profile fallback: build taste from chosen genres instead. */
  manualGenres?: string[];
  /** CheapShark candidate pages (60 deals each). Default 3. */
  dealPages?: number;
  /** Drop matches below this blended score (0..1). */
  minScore?: number;
  // --- user preferences ---
  /** Price ceiling in USD passed to CheapShark to narrow at source. */
  maxPrice?: string;
  /** Drop deals discounted less than this percent (0..100). */
  minDiscount?: number;
  /** Drop deals in these genres. */
  excludeGenres?: string[];
  /** Boost deals in these genres. */
  preferGenres?: string[];
  onProgress?: (p: EnrichProgress) => void;
  signal?: AbortSignal;
}

export interface CurateResult {
  profile: TasteProfile;
  results: ScoredDeal[];
  /** how many live deals were scored */
  dealsConsidered: number;
  ownedCount: number;
  usedFallback: boolean;
}

export async function curate(input: CurateInput): Promise<CurateResult> {
  const usedFallback = Boolean(input.manualGenres?.length) && input.owned.length === 0;

  // 1. Candidate deals (sorted by CheapShark's own deal rating for quality).
  const deals = await getDealPool({
    pages: input.dealPages ?? 3,
    sort: "Deal Rating",
    maxPrice: input.maxPrice,
  });

  const dealAppIds = deals
    .map((d) => (d.steamAppID ? Number(d.steamAppID) : NaN))
    .filter((n) => Number.isFinite(n));
  const ownedAppIds = input.owned.map((g) => g.appid);

  // 2. Enrich owned + candidate apps together through the shared cache.
  const allIds = Array.from(new Set<number>([...ownedAppIds, ...dealAppIds]));
  const meta = await enrichLibrary(allIds, {
    onProgress: input.onProgress,
    signal: input.signal,
  });

  // 3. Taste profile (real library, or manual fallback).
  const profile = usedFallback
    ? profileFromGenres(input.manualGenres!)
    : buildTasteProfile(input.owned, meta);

  // 4. Rank, excluding owned titles and applying preferences.
  const results = scoreDeals(deals, meta, profile, {
    ownedAppIds: new Set(ownedAppIds),
    minScore: input.minScore ?? 0,
    minDiscount: input.minDiscount,
    excludeGenres: input.excludeGenres,
    preferGenres: input.preferGenres,
  });

  return {
    profile,
    results,
    dealsConsidered: deals.length,
    ownedCount: input.owned.length,
    usedFallback,
  };
}
