// Build a playtime-weighted taste profile from an enriched Steam library.
//
// GetOwnedGames gives playtime; appdetails gives genres. We turn "200 hours of
// Action-RPGs, 12 minutes of a puzzle game" into a normalized genre distribution
// that downstream matching scores deals against.
//
// Pure + server-safe (no I/O) so it's unit-testable.

import type { AppMetadata } from "./appdetails";

export interface OwnedGame {
  appid: number;
  playtimeMinutes: number;
}

export interface TasteProfile {
  /** genre → weight, normalized to sum to 1 across all genres. */
  genres: Record<string, number>;
  /** feature/category → weight, normalized (secondary signal). */
  categories: Record<string, number>;
  topGenres: { genre: string; weight: number }[];
  gamesAnalyzed: number;
  /** total raw weight before normalization (diagnostic). */
  totalWeight: number;
}

/**
 * How much a single owned game counts toward taste.
 *
 * Ownership alone is a weak signal (`1`); playtime adds a sub-linear bonus so a
 * 200-hour favourite dominates a barely-touched title without drowning the
 * profile in a single genre. sqrt(hours) → 12 min ≈ 1.45, 200 h ≈ 15.1.
 */
export function gameWeight(playtimeMinutes: number): number {
  const hours = Math.max(0, playtimeMinutes) / 60;
  return 1 + Math.sqrt(hours);
}

export function buildTasteProfile(
  owned: OwnedGame[],
  meta: Map<number, AppMetadata>,
): TasteProfile {
  const genres: Record<string, number> = {};
  const categories: Record<string, number> = {};
  let totalWeight = 0;
  let gamesAnalyzed = 0;

  for (const game of owned) {
    const m = meta.get(game.appid);
    if (!m || m.type !== "game" || m.genres.length === 0) continue;

    gamesAnalyzed++;
    const w = gameWeight(game.playtimeMinutes);
    totalWeight += w;

    // Split a game's weight evenly across its genres so a 5-genre title doesn't
    // count 5x a single-genre one.
    const perGenre = w / m.genres.length;
    for (const g of m.genres) genres[g] = (genres[g] ?? 0) + perGenre;

    if (m.categories.length > 0) {
      const perCat = (w * 0.4) / m.categories.length;
      for (const c of m.categories) categories[c] = (categories[c] ?? 0) + perCat;
    }
  }

  normalize(genres);
  normalize(categories);

  const topGenres = Object.entries(genres)
    .map(([genre, weight]) => ({ genre, weight }))
    .sort((a, b) => b.weight - a.weight);

  return { genres, categories, topGenres, gamesAnalyzed, totalWeight };
}

/** Scale a weight map so its values sum to 1 (no-op if empty). */
function normalize(map: Record<string, number>) {
  const sum = Object.values(map).reduce((a, b) => a + b, 0);
  if (sum <= 0) return;
  for (const key of Object.keys(map)) map[key] /= sum;
}

/** Build a profile directly from chosen genres (manual fallback for private profiles). */
export function profileFromGenres(selectedGenres: string[]): TasteProfile {
  const genres: Record<string, number> = {};
  for (const g of selectedGenres) genres[g] = 1;
  normalize(genres);
  const topGenres = Object.entries(genres)
    .map(([genre, weight]) => ({ genre, weight }))
    .sort((a, b) => b.weight - a.weight);
  return {
    genres,
    categories: {},
    topGenres,
    gamesAnalyzed: 0,
    totalWeight: selectedGenres.length,
  };
}
