// Thin client for the CheapShark API (https://apidocs.cheapshark.com).
// CheapShark aggregates store prices; we scope every query to Steam (storeID 1).
// No API key is required.

const API_BASE = "https://www.cheapshark.com/api/1.0";
const STEAM_STORE_ID = "1";

/** A single deal as returned by CheapShark. All values arrive as strings. */
export interface Deal {
  internalName: string;
  title: string;
  metacriticLink: string | null;
  dealID: string;
  storeID: string;
  gameID: string;
  salePrice: string;
  normalPrice: string;
  isOnSale: string;
  savings: string;
  metacriticScore: string;
  steamRatingText: string | null;
  steamRatingPercent: string;
  steamRatingCount: string;
  steamAppID: string | null;
  releaseDate: number;
  lastChange: number;
  dealRating: string;
  thumb: string;
}

export interface DealsQuery {
  /** Free-text title search. */
  q?: string;
  /** One of the SORT_OPTIONS values. */
  sort?: string;
  /** Upper price bound in USD, e.g. "20". */
  maxPrice?: string;
  pageSize?: number;
}

/** User-facing sort choices mapped to CheapShark `sortBy` values. */
export const SORT_OPTIONS = [
  { value: "Savings", label: "Biggest discount" },
  { value: "Price", label: "Lowest price" },
  { value: "Deal Rating", label: "Best deal rating" },
  { value: "Metacritic", label: "Metacritic score" },
  { value: "Reviews", label: "Most Steam reviews" },
  { value: "recent", label: "Recently added" },
] as const;

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value as string));

/** Fetch on-sale Steam games matching the query. */
export async function getSteamDeals(query: DealsQuery): Promise<Deal[]> {
  const params = new URLSearchParams({
    storeID: STEAM_STORE_ID,
    onSale: "1",
    pageSize: String(query.pageSize ?? 60),
    sortBy: query.sort && VALID_SORTS.has(query.sort) ? query.sort : "Savings",
  });
  if (query.q?.trim()) params.set("title", query.q.trim());
  if (query.maxPrice) params.set("upperPrice", query.maxPrice);

  // Deals shift slowly; cache the upstream response for 30 minutes so repeated
  // visits and filter tweaks don't hammer the API.
  const res = await fetch(`${API_BASE}/deals?${params.toString()}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    throw new Error(`CheapShark responded ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch a wider candidate pool by paging. CheapShark caps pageSize at 60, so we
 * walk `pages` pages. Used by curation, which needs more than one screenful to
 * rank against a taste profile.
 */
export async function getDealPool(
  query: DealsQuery & { pages?: number },
): Promise<Deal[]> {
  const pages = Math.max(1, query.pages ?? 2);
  const requests = Array.from({ length: pages }, (_, page) =>
    fetchDealPage({ ...query, pageSize: 60 }, page),
  );
  const results = await Promise.all(requests);
  // De-dupe by dealID in case pages overlap.
  const seen = new Set<string>();
  const pool: Deal[] = [];
  for (const deal of results.flat()) {
    if (!seen.has(deal.dealID)) {
      seen.add(deal.dealID);
      pool.push(deal);
    }
  }
  return pool;
}

async function fetchDealPage(query: DealsQuery, pageNumber: number): Promise<Deal[]> {
  const params = new URLSearchParams({
    storeID: STEAM_STORE_ID,
    onSale: "1",
    pageSize: String(query.pageSize ?? 60),
    pageNumber: String(pageNumber),
    sortBy: query.sort && VALID_SORTS.has(query.sort) ? query.sort : "Deal Rating",
  });
  if (query.q?.trim()) params.set("title", query.q.trim());
  if (query.maxPrice) params.set("upperPrice", query.maxPrice);

  const res = await fetch(`${API_BASE}/deals?${params}`, {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`CheapShark responded ${res.status}`);
  return res.json();
}

/**
 * Build the CheapShark redirect link that sends the user to the Steam store
 * page for this deal. The dealID arrives already URL-encoded, so embed it
 * verbatim — re-encoding it breaks the link.
 */
export function dealRedirectUrl(dealID: string): string {
  return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
}

/** Direct link to the game's Steam store page, when the app id is known. */
export function steamStoreUrl(steamAppID: string | null): string | null {
  return steamAppID ? `https://store.steampowered.com/app/${steamAppID}/` : null;
}
