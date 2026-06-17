// Historical-low pricing, so we can flag genuine all-time lows vs "fake urgency"
// sales. CheapShark's /games?id=<gameID> returns cheapestPriceEver; gameID is
// stable per game, so we cache by it.
//
// Server-only.

import { NamespaceCache } from "./cache";

export interface GameLow {
  price: number;
  date: number;
}

const DAY = 24 * 60 * 60 * 1000;
const lowCache = new NamespaceCache<GameLow | null>("gamelow", 3 * DAY);
const GAMES_URL = "https://www.cheapshark.com/api/1.0/games";

async function fetchGameLow(gameID: string): Promise<GameLow | null> {
  try {
    const res = await fetch(`${GAMES_URL}?id=${encodeURIComponent(gameID)}`, {
      next: { revalidate: 60 * 60 * 12 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      cheapestPriceEver?: { price: string; date: number };
    };
    const cheapest = body.cheapestPriceEver;
    if (!cheapest) return null;
    return { price: Number(cheapest.price), date: cheapest.date };
  } catch {
    return null;
  }
}

/** Batch-fetch historical lows for the given gameIDs, cached + concurrency-bounded. */
export async function enrichLows(
  gameIDs: string[],
  concurrency = 8,
): Promise<Map<string, GameLow>> {
  const unique = Array.from(new Set(gameIDs));
  const result = new Map<string, GameLow>();

  const { hits } = await lowCache.getMany(unique);
  const misses: string[] = [];
  for (const id of unique) {
    const cached = hits.get(id);
    if (cached !== undefined) {
      if (cached) result.set(id, cached);
    } else {
      misses.push(id);
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < misses.length) {
      const id = misses[cursor++];
      const low = await fetchGameLow(id);
      lowCache.set(id, low);
      if (low) result.set(id, low);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, misses.length || 1) }, worker),
  );

  await lowCache.persist();
  return result;
}
