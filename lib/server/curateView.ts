// Map internal ScoredDeal objects to the public CuratedDeal shape used by both
// the /api/curate response and the email digest. One mapping, one contract.

import { dealRedirectUrl, steamStoreUrl } from "@/lib/cheapshark";
import type { CuratedDeal } from "@/lib/curatorTypes";
import type { ScoredDeal } from "./match";
import type { GameLow } from "./historicalLow";

export function toCuratedDeals(
  scored: ScoredDeal[],
  max: number,
  lows?: Map<string, GameLow>,
): CuratedDeal[] {
  return scored.slice(0, max).map((s) => {
    const low = lows?.get(s.deal.gameID) ?? null;
    const salePrice = Number(s.deal.salePrice);
    // A penny of slack absorbs rounding between CheapShark snapshots.
    const isAllTimeLow = low !== null && salePrice <= low.price + 0.01;
    return {
      title: s.deal.title,
      steamAppID: s.deal.steamAppID,
      salePrice: s.deal.salePrice,
      normalPrice: s.deal.normalPrice,
      savings: Math.round(Number(s.deal.savings)),
      thumb: s.deal.thumb,
      steamRatingPercent: Number(s.deal.steamRatingPercent) || null,
      steamRatingText: s.deal.steamRatingText,
      metacritic: s.meta?.metacritic ?? null,
      genres: s.meta?.genres ?? [],
      matchedGenres: s.matchedGenres,
      score: Number(s.score.toFixed(3)),
      tasteScore: Number(s.tasteScore.toFixed(3)),
      historicalLow: low ? low.price : null,
      isAllTimeLow,
      dealUrl: dealRedirectUrl(s.deal.dealID),
      steamUrl: steamStoreUrl(s.deal.steamAppID),
    };
  });
}
