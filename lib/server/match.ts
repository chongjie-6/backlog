// Rank live deals against a taste profile.
//
// Blend three signals: how well the deal's genres match the user's taste, how
// deep the discount is, and how well-reviewed the game is. Games the user
// already owns are excluded. Pure + server-safe.

import type { Deal } from "@/lib/cheapshark";
import type { AppMetadata } from "./appdetails";
import type { TasteProfile } from "./taste";

export interface ScoredDeal {
  deal: Deal;
  meta: AppMetadata | null;
  /** 0..1 — overlap between the deal's genres and the taste profile. */
  tasteScore: number;
  /** 0..1 — discount depth. */
  discountScore: number;
  /** 0..1 — review/Metacritic quality. */
  qualityScore: number;
  /** 0..1 — blended ranking score. */
  score: number;
  /** profile genres this deal hits, strongest first — for "why" copy. */
  matchedGenres: string[];
}

/** Blend weights. Taste is the differentiator, so it leads. Exported for tuning. */
export const WEIGHTS = { taste: 0.55, discount: 0.25, quality: 0.2 } as const;

export interface MatchOptions {
  /** Steam appIDs the user owns — excluded from results. */
  ownedAppIds?: Set<number>;
  /** Drop deals scoring below this (0..1) after weighting. */
  minScore?: number;
  /** Drop deals discounted less than this percent (0..100). */
  minDiscount?: number;
  /** Drop deals whose genres include any of these. */
  excludeGenres?: string[];
  /** Nudge deals in these genres up the ranking. */
  preferGenres?: string[];
}

/** Bonus added to a deal's score when it hits a preferred genre. */
const PREFER_BOOST = 0.1;

export function scoreDeals(
  deals: Deal[],
  dealMeta: Map<number, AppMetadata>,
  profile: TasteProfile,
  opts: MatchOptions = {},
): ScoredDeal[] {
  const owned = opts.ownedAppIds ?? new Set<number>();
  const exclude = new Set((opts.excludeGenres ?? []).map((g) => g.toLowerCase()));
  const prefer = new Set((opts.preferGenres ?? []).map((g) => g.toLowerCase()));
  const minDiscount = opts.minDiscount ?? 0;

  // L2 norm of the profile vector, precomputed for cosine similarity below.
  const profileNorm =
    Math.sqrt(Object.values(profile.genres).reduce((a, w) => a + w * w, 0)) || 1;

  const scored: ScoredDeal[] = [];
  for (const deal of deals) {
    const appid = deal.steamAppID ? Number(deal.steamAppID) : NaN;
    if (Number.isFinite(appid) && owned.has(appid)) continue; // exclude owned
    if (Number(deal.savings) < minDiscount) continue; // preference: min discount

    const meta = (Number.isFinite(appid) && dealMeta.get(appid)) || null;

    // Preference: exclude unwanted genres.
    if (exclude.size > 0 && meta?.genres.some((g) => exclude.has(g.toLowerCase()))) {
      continue;
    }

    const { tasteScore, matchedGenres } = tasteMatch(meta, profile, profileNorm);
    const discountScore = clamp01(Number(deal.savings) / 100);
    const qualityScore = quality(deal, meta);

    let score =
      WEIGHTS.taste * tasteScore +
      WEIGHTS.discount * discountScore +
      WEIGHTS.quality * qualityScore;

    // Preference: boost preferred genres.
    if (prefer.size > 0 && meta?.genres.some((g) => prefer.has(g.toLowerCase()))) {
      score = clamp01(score + PREFER_BOOST);
    }

    scored.push({
      deal,
      meta,
      tasteScore,
      discountScore,
      qualityScore,
      score,
      matchedGenres,
    });
  }

  const min = opts.minScore ?? 0;
  return scored
    .filter((s) => s.score >= min)
    .sort((a, b) => b.score - a.score);
}

/**
 * Cosine similarity between the deal's (binary) genre vector and the taste
 * distribution. Normalizing by the deal's genre count stops broad multi-genre
 * titles from automatically out-scoring focused ones that align just as well.
 */
function tasteMatch(
  meta: AppMetadata | null,
  profile: TasteProfile,
  profileNorm: number,
): { tasteScore: number; matchedGenres: string[] } {
  if (!meta || meta.genres.length === 0) {
    return { tasteScore: 0, matchedGenres: [] };
  }
  let dot = 0;
  const matched: { genre: string; weight: number }[] = [];
  for (const g of meta.genres) {
    const w = profile.genres[g];
    if (w && w > 0) {
      dot += w;
      matched.push({ genre: g, weight: w });
    }
  }
  matched.sort((a, b) => b.weight - a.weight);
  const dealNorm = Math.sqrt(meta.genres.length);
  return {
    tasteScore: clamp01(dot / (profileNorm * dealNorm)),
    matchedGenres: matched.map((m) => m.genre),
  };
}

/**
 * Quality from Steam reviews when there are enough of them, else Metacritic,
 * else a neutral 0.5 so unrated games aren't unfairly buried.
 */
function quality(deal: Deal, meta: AppMetadata | null): number {
  const ratingCount = Number(deal.steamRatingCount);
  const ratingPercent = Number(deal.steamRatingPercent);
  if (ratingCount >= 50 && ratingPercent > 0) return clamp01(ratingPercent / 100);

  const metacritic = meta?.metacritic ?? Number(deal.metacriticScore);
  if (metacritic > 0) return clamp01(metacritic / 100);

  return 0.5;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
