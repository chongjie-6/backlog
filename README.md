# Game Deal Curator

PC game deals matched to your **actual taste**, inferred from your Steam library —
not just "what's on sale today." Connect Steam, we read your owned games + playtime,
build a playtime-weighted genre profile, then rank live discounts by how well they
match (excluding games you already own).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the architecture decision and priorities.

## Run it

```bash
cp .env.example .env   # fill in STEAM_API_KEY + CURATOR_SECRET (see below)
npm run dev
```

Open http://localhost:3000.

- **Connect with Steam** — real personalization (needs `STEAM_API_KEY`).
- **Try with a demo library** — runs the whole pipeline against a sample
  RPG/strategy library; no key required. Great for a first look.
- **/deals** — the unfiltered "all current Steam deals" browser.

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `STEAM_API_KEY` | for real libraries | Server-only. Reads owned games via `GetOwnedGames`. [Get one here](https://steamcommunity.com/dev/apikey). |
| `CURATOR_SECRET` | in production | HMAC key for the signed session cookie. `openssl rand -base64 32`. |
| `NEXT_PUBLIC_SUPABASE_*` | later | Durable persistence + the daily-digest cron. |

`STEAM_API_KEY` must **never** be `NEXT_PUBLIC_*` — it stays server-side.

## How it works

1. **Login** — Steam OpenID 2.0 (no key); we verify the callback and store only the
   signed SteamID64 in an httpOnly cookie.
2. **Library** — `GetOwnedGames` returns app IDs + playtime. Private profiles fall
   back to manual genre selection.
3. **Enrichment** — each title is hydrated with genres from the public Steam store
   API, cached aggressively (memory + disk; Supabase in prod) to respect rate limits.
4. **Taste profile** — a playtime-weighted genre distribution (`1 + √hours`).
5. **Match** — live CheapShark deals are scored by `taste × discount × quality`,
   owned games excluded, and ranked. Deal links use CheapShark's required redirect.

## Project layout

- `lib/server/` — server-only engine: `steam`, `appdetails`, `enrich`, `cache`,
  `taste`, `match`, `curate`, `openid`, `session`.
- `lib/cheapshark.ts`, `lib/curatorTypes.ts` — shared deal client + API contract.
- `app/api/curate` — the curation endpoint. `app/api/auth/steam/*` — login flow.
- `app/page.tsx` + `app/components/` — the curator UI.
