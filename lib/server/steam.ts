// Steam Web API client. The API key is read from STEAM_API_KEY and stays here —
// server-only, never shipped to the client.
//
// GetOwnedGames returns app IDs + playtime but no genres (that's what enrichment
// is for). Private profiles return an empty response; we surface that distinctly
// so the UI can offer the manual-genre fallback.

import type { OwnedGame } from "./taste";

const API = "https://api.steampowered.com";

export class SteamConfigError extends Error {}
export class SteamPrivateProfileError extends Error {}

function apiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new SteamConfigError(
      "STEAM_API_KEY is not configured on the server.",
    );
  }
  return key;
}

interface OwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: { appid: number; playtime_forever: number }[];
  };
}

/**
 * Fetch a user's owned games + playtime (minutes).
 * @throws SteamPrivateProfileError if the library isn't publicly visible.
 * @throws SteamConfigError if the API key is missing.
 */
export async function getOwnedGames(steamId: string): Promise<OwnedGame[]> {
  const params = new URLSearchParams({
    key: apiKey(),
    steamid: steamId,
    include_played_free_games: "1",
    include_appinfo: "0",
    format: "json",
  });

  const res = await fetch(
    `${API}/IPlayerService/GetOwnedGames/v1/?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Steam API responded ${res.status}`);

  const body = (await res.json()) as OwnedGamesResponse;
  // Private profile / hidden game details → empty object, no `games`.
  if (!body.response || body.response.games === undefined) {
    throw new SteamPrivateProfileError(
      "This Steam profile's game details are private.",
    );
  }

  return body.response.games.map((g) => ({
    appid: g.appid,
    playtimeMinutes: g.playtime_forever,
  }));
}

interface PlayerSummaryResponse {
  response?: {
    players?: {
      steamid: string;
      personaname: string;
      avatarmedium: string;
      profileurl: string;
    }[];
  };
}

export interface SteamPlayer {
  steamId: string;
  name: string;
  avatar: string;
  profileUrl: string;
}

/** Display name + avatar for the connected account (best-effort). */
export async function getPlayerSummary(steamId: string): Promise<SteamPlayer | null> {
  const params = new URLSearchParams({ key: apiKey(), steamids: steamId });
  const res = await fetch(
    `${API}/ISteamUser/GetPlayerSummaries/v2/?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as PlayerSummaryResponse;
  const p = body.response?.players?.[0];
  if (!p) return null;
  return {
    steamId: p.steamid,
    name: p.personaname,
    avatar: p.avatarmedium,
    profileUrl: p.profileurl,
  };
}

/** Resolve a vanity URL name (steamcommunity.com/id/<name>) to a 64-bit id. */
export async function resolveVanityUrl(vanity: string): Promise<string | null> {
  const params = new URLSearchParams({ key: apiKey(), vanityurl: vanity });
  const res = await fetch(
    `${API}/ISteamUser/ResolveVanityURL/v1/?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    response?: { success: number; steamid?: string };
  };
  return body.response?.success === 1 ? body.response.steamid ?? null : null;
}
