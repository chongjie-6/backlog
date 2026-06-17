// Enrich a Steam appID with the genre/tag signal the taste profile needs.
//
// GetOwnedGames gives app IDs + playtime but no genres, so we hydrate each title
// from Steam's public store endpoint (no API key). It is rate-limited (~200 req /
// 5 min / IP), so every lookup goes through `appDetailsCache` and batch enrichment
// runs at low concurrency (see enrich.ts).
//
// Server-only.

import { appDetailsCache } from "./cache";

export interface AppMetadata {
  appid: number;
  name: string;
  /** "game" | "dlc" | "demo" | ... — we only build taste from "game". */
  type: string;
  isFree: boolean;
  /** Steam store genres, e.g. ["Action", "RPG"]. Primary taste signal. */
  genres: string[];
  /** Store categories (features), e.g. ["Single-player", "Co-op"]. Secondary. */
  categories: string[];
  metacritic: number | null;
}

interface StoreResponse {
  [appid: string]: {
    success: boolean;
    data?: {
      type?: string;
      name?: string;
      is_free?: boolean;
      genres?: { id: string; description: string }[];
      categories?: { id: number; description: string }[];
      metacritic?: { score?: number };
    };
  };
}

const STORE_URL = "https://store.steampowered.com/api/appdetails";

/**
 * Fetch + cache metadata for a single appID.
 * Resolves to `null` (cached) when the app has no store data (delisted, region
 * locked, not a public game) so we don't retry it every run.
 */
export async function fetchAppDetails(appid: number): Promise<AppMetadata | null> {
  const key = String(appid);
  const cached = await appDetailsCache.get(key);
  if (cached !== undefined) return cached;

  const meta = await requestAppDetails(appid);
  appDetailsCache.set(key, meta);
  return meta;
}

async function requestAppDetails(appid: number): Promise<AppMetadata | null> {
  const params = new URLSearchParams({
    appids: String(appid),
    filters: "basic,genres,categories,metacritic",
    l: "english",
    cc: "us",
  });

  let res: Response;
  try {
    res = await fetch(`${STORE_URL}?${params}`, {
      headers: { "Accept-Language": "en" },
      // Long revalidate; the durable layer is appDetailsCache.
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let body: StoreResponse;
  try {
    body = (await res.json()) as StoreResponse;
  } catch {
    return null;
  }

  const entry = body[String(appid)];
  if (!entry?.success || !entry.data) return null;

  const d = entry.data;
  return {
    appid,
    name: d.name ?? "",
    type: d.type ?? "unknown",
    isFree: Boolean(d.is_free),
    genres: (d.genres ?? []).map((g) => g.description),
    categories: (d.categories ?? []).map((c) => c.description),
    metacritic: d.metacritic?.score ?? null,
  };
}
