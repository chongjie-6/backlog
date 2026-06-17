// Steam "Sign in through Steam" — OpenID 2.0. No API key needed for the login
// itself; it just hands us a verified SteamID64.
//
// Flow:
//   1. Redirect the user to Steam with our return_to URL (buildSteamLoginUrl).
//   2. Steam redirects back with openid.* params.
//   3. We re-POST those params with mode=check_authentication; Steam confirms
//      `is_valid:true`. Only then do we trust the claimed id (verifyOpenIdCallback).
//
// Server-only.

const OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const STEAM_ID_RE =
  /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function buildSteamLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    "openid.ns": NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${OPENID_ENDPOINT}?${params}`;
}

/**
 * Validate the callback query against Steam and return the verified SteamID64,
 * or null if anything fails. Never trust openid.claimed_id without this check.
 */
export async function verifyOpenIdCallback(
  query: URLSearchParams,
): Promise<string | null> {
  if (query.get("openid.mode") !== "id_res") return null;

  const claimedId = query.get("openid.claimed_id") ?? "";
  const match = STEAM_ID_RE.exec(claimedId);
  if (!match) return null;

  // Echo every param back with mode=check_authentication.
  const verify = new URLSearchParams(query);
  verify.set("openid.mode", "check_authentication");

  let res: Response;
  try {
    res = await fetch(OPENID_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verify.toString(),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const text = await res.text();
  return /is_valid\s*:\s*true/i.test(text) ? match[1] : null;
}
