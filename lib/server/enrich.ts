// Batch genre enrichment for a whole library.
//
// First-run enrichment can be hundreds of store calls, so this runs as a bounded
// concurrency pool with progress callbacks (so the UI can show a bar instead of
// blocking) and flushes the cache once at the end. Cache hits are free and never
// re-fetched.
//
// Server-only.

import { fetchAppDetails, type AppMetadata } from "./appdetails";
import { appDetailsCache } from "./cache";

export interface EnrichProgress {
  total: number;
  /** processed so far (cache hits + network fetches) */
  done: number;
  cached: number;
  fetched: number;
}

export interface EnrichOptions {
  /** Parallel in-flight store requests. Keep low to respect rate limits. */
  concurrency?: number;
  /** Optional delay between starting fetches, ms — extra rate-limit safety. */
  delayMs?: number;
  onProgress?: (p: EnrichProgress) => void;
  signal?: AbortSignal;
}

/**
 * Enrich `appids` into a map of appID → metadata. Apps with no public store
 * data (delisted, not a game) are simply absent from the result.
 */
export async function enrichLibrary(
  appids: number[],
  opts: EnrichOptions = {},
): Promise<Map<number, AppMetadata>> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const delayMs = opts.delayMs ?? 0;
  const result = new Map<number, AppMetadata>();

  const progress: EnrichProgress = {
    total: appids.length,
    done: 0,
    cached: 0,
    fetched: 0,
  };

  // Separate cache hits from misses up front so progress is accurate and we
  // don't spin up workers for already-known apps.
  const { hits } = await appDetailsCache.getMany(appids.map(String));
  const misses: number[] = [];
  for (const id of appids) {
    const cached = hits.get(String(id));
    if (cached !== undefined) {
      if (cached) result.set(id, cached);
      progress.cached++;
      progress.done++;
    } else {
      misses.push(id);
    }
  }
  opts.onProgress?.({ ...progress });

  let cursor = 0;
  async function worker() {
    while (cursor < misses.length) {
      if (opts.signal?.aborted) return;
      const appid = misses[cursor++];
      if (delayMs) await sleep(delayMs);
      const meta = await fetchAppDetails(appid);
      if (meta) result.set(appid, meta);
      progress.fetched++;
      progress.done++;
      opts.onProgress?.({ ...progress });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, misses.length || 1) }, worker),
  );

  await appDetailsCache.persist();
  return result;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
