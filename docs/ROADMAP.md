# Game Deal Curator — Roadmap & Decisions

PC game deals matched to a user's actual taste, inferred from their Steam library.
Differentiator: **"deals on games you'd like,"** not "today's discounts."

## Architecture decision (the open question in the PRD)

**Hosted web app + backend (Next.js route handlers) + Postgres (Supabase).**

Why, not desktop:

- The Steam Web API key must stay server-side — a backend is mandatory either way,
  so "pure frontend" is already off the table.
- This repo is already Next.js 16 + Supabase. Route handlers give us the server
  surface for the secret key; Supabase gives us auth-adjacent persistence + a place
  to run the daily digest cron. Email alerts are device-independent (push), which a
  machine-bound desktop app can't match.

Consequence: alerts are **push (daily email)**, not pull-on-launch.

### Secrets

- `STEAM_API_KEY` — server-only. Never `NEXT_PUBLIC_*`. Read only inside route
  handlers / server modules under `lib/server/`.
- Supabase publishable key is already public-safe (RLS-gated). Service-role key, when
  added, stays server-side for the cron job.

### Persistence is pluggable

`lib/store` exposes an interface. Dev/verification uses a file-backed store so the
whole pipeline runs offline; production uses Supabase. Caches degrade to in-memory.

## Ranked priorities

Ranking drives build order. 1 = build first.

| # | Capability | Why this rank |
|---|------------|---------------|
| 1 | **Taste inference engine** (enrich genres → playtime-weighted profile) | The differentiator. Pure + testable with public `appdetails`. Everything downstream depends on the profile. |
| 2 | **Deal aggregation** (CheapShark, Steam-scoped) | Already have a base. The other half of the match. |
| 3 | **Matching / curation** (score by taste × discount × rating, exclude owned) | The actual product output — the "leanest POC" endpoint. |
| 4 | **Caching** (NFR, mandatory) | Enrichment is hundreds of calls; without caching we hit rate limits immediately. Built alongside #1. |
| 5 | **Steam connection** (OpenID login + GetOwnedGames, key server-side) | The real data source. Built behind env vars with a demo-library fallback so #1–#3 are usable without a key. |
| 6 | **Private-profile handling + manual genre fallback** | Graceful degradation; part of making #5 production-ready. |
| 7 | **Background enrichment job + progress** (NFR) | First-run enrichment can't block the UI. Needed once real libraries (hundreds of titles) are in play. |
| 8 | **Preferences** (price ceiling, min discount %, genres, stores, wishlist) | Curation gets noisy without it — but only matters once matching is good. |
| 9 | **Data privacy** (disconnect / delete, minimal persistence) | Required before storing real libraries at scale. |
| 10 | **Daily email digest** + cron | Retention. Last, per the PRD's own sequencing. |
| 11 | **Historical low** (ITAD or CheapShark price history) | "Real deal vs fake urgency." Nice-to-have polish. |

## v1 slice (leanest POC)

Steam login → library read → genre profile → match against today's CheapShark deals →
ranked, owned-excluded list. Demo library stands in for login until `STEAM_API_KEY` is set.

## Scope boundaries (v1)

- PC only; taste inferred from Steam only (deals may span stores).
- No social/sharing.

## Status

- [x] Base CheapShark deals browser (`/deals`)
- [x] Taste engine + matching (enrich → playtime-weighted profile → ranked, owned-excluded)
- [x] Caching (memory + disk; Supabase in prod)
- [x] Steam OpenID login + signed session + GetOwnedGames (server-side key)
- [x] Private-profile handling + manual genre fallback
- [x] Preferences (price ceiling, min discount, min match, exclude/prefer genres)
- [x] Daily email digest: generation, preview, pluggable mailer (Resend), subscribers, cron
- [x] Data privacy: disconnect (clears session) + unsubscribe (deletes stored record)
- [x] Historical-low signal (CheapShark price history) flags all-time lows vs fake urgency
- [x] Cosine taste-matching (normalizes for genre breadth — focused matches rank fairly)
- [x] Background enrichment with live SSE progress for large libraries
- [x] Durable persistence: Supabase subscriber store (gated on service role) with file fallback;
      schema in `supabase/migrations/0001_curator.sql`. Genre enrichment rides Next's durable
      fetch cache (`revalidate`) in prod, so it isn't tied to the local file cache.

## Data privacy

We persist the minimum:

- **Session**: only the signed SteamID64, in an httpOnly cookie. **Disconnect**
  (`/api/auth/steam/logout`) clears it.
- **Digest subscribers**: SteamID + email + preferences, only if you opt in.
  **Unsubscribe** (one-click email link or in-app) deletes the record entirely.
- The library itself is never stored — it's read on demand and only enriched
  genres are cached (non-personal, keyed by appID).
