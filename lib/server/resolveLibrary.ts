// Resolve which owned-games library a curate request should use:
// manual genres > demo > the connected Steam account. Shared by the JSON and
// SSE curate endpoints so the auth/error handling lives in one place.
//
// Server-only.

import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySteamCookie } from "./session";
import {
  getOwnedGames,
  SteamConfigError,
  SteamPrivateProfileError,
} from "./steam";
import { demoLibrary } from "./demoLibrary";
import type { OwnedGame } from "./taste";

export type LibraryResult =
  | { ok: true; owned: OwnedGame[] }
  | { ok: false; status: number; error: string; code: string };

export async function resolveLibrary(
  request: NextRequest,
  opts: { demo: boolean; manualGenres?: string[] },
): Promise<LibraryResult> {
  if (opts.manualGenres?.length) return { ok: true, owned: [] };
  if (opts.demo) return { ok: true, owned: demoLibrary };

  const steamId = verifySteamCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!steamId) {
    return {
      ok: false,
      status: 401,
      error: "Not connected. Sign in with Steam or pass ?demo=1.",
      code: "not_connected",
    };
  }

  try {
    return { ok: true, owned: await getOwnedGames(steamId) };
  } catch (e) {
    if (e instanceof SteamPrivateProfileError) {
      return { ok: false, status: 409, error: e.message, code: "private_profile" };
    }
    if (e instanceof SteamConfigError) {
      return { ok: false, status: 503, error: e.message, code: "no_steam_key" };
    }
    return {
      ok: false,
      status: 502,
      error: "Couldn't read your Steam library.",
      code: "steam_error",
    };
  }
}
