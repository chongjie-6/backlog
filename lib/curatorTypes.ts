// Shared shapes for the /api/curate response. Safe to import from client and
// server (no server-only deps), so the route and the UI agree on one contract.

export interface CuratedDeal {
  title: string;
  steamAppID: string | null;
  salePrice: string;
  normalPrice: string;
  savings: number;
  thumb: string;
  steamRatingPercent: number | null;
  steamRatingText: string | null;
  metacritic: number | null;
  genres: string[];
  /** profile genres this deal hits, strongest first */
  matchedGenres: string[];
  /** blended ranking score, 0..1 */
  score: number;
  /** taste-only score, 0..1 */
  tasteScore: number;
  /** lowest price this game has ever been, per CheapShark; null if unknown */
  historicalLow: number | null;
  /** true when the current sale price matches/beats the all-time low */
  isAllTimeLow: boolean;
  /** CheapShark redirect (required by their terms when sending users to a deal) */
  dealUrl: string;
  steamUrl: string | null;
}

/** User curation preferences. Persisted client-side, sent to /api/curate. */
export interface Preferences {
  /** price ceiling in USD; "" = any */
  maxPrice: string;
  /** minimum discount percent; 0 = any */
  minDiscount: number;
  /** minimum match score 0..1; 0 = show all */
  minScore: number;
  /** genres to exclude entirely */
  exclude: string[];
  /** genres to nudge up the ranking */
  prefer: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  maxPrice: "",
  minDiscount: 0,
  minScore: 0,
  exclude: [],
  prefer: [],
};

/** Serialize preferences into /api/curate query params (skips defaults). */
export function preferencesToParams(p: Preferences): string {
  const params = new URLSearchParams();
  if (p.maxPrice) params.set("maxPrice", p.maxPrice);
  if (p.minDiscount > 0) params.set("minDiscount", String(p.minDiscount));
  if (p.minScore > 0) params.set("minScore", String(p.minScore));
  if (p.exclude.length) params.set("exclude", p.exclude.join(","));
  if (p.prefer.length) params.set("prefer", p.prefer.join(","));
  return params.toString();
}

export interface CurateResponse {
  profile: {
    topGenres: { genre: string; weight: number }[];
    gamesAnalyzed: number;
  };
  meta: {
    dealsConsidered: number;
    ownedCount: number;
    usedFallback: boolean;
    returned: number;
  };
  results: CuratedDeal[];
}
