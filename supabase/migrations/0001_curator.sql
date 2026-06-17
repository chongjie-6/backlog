-- Game Deal Curator schema.
-- Apply with the Supabase SQL editor or `supabase db push`.
--
-- We persist the minimum: digest subscribers (opt-in) and a shared, non-personal
-- genre cache. The library itself is never stored.

-- Digest subscribers -------------------------------------------------------
create table if not exists public.digest_subscribers (
  steam_id      text primary key,
  email         text not null,
  prefs         jsonb not null default '{}'::jsonb,
  manual_genres text[],
  created_at    timestamptz not null default now()
);

-- RLS on with no public policies => only the service role (the server / cron)
-- can read or write. The anon/publishable key cannot touch this table.
alter table public.digest_subscribers enable row level security;

-- Genre enrichment cache (shared, non-personal) ----------------------------
create table if not exists public.app_genres (
  appid      integer primary key,
  name       text,
  type       text,
  is_free    boolean,
  genres     text[] not null default '{}',
  categories text[] not null default '{}',
  metacritic integer,
  updated_at timestamptz not null default now()
);

alter table public.app_genres enable row level security;

-- Genre data is public; allow anon read, restrict writes to the service role.
drop policy if exists "app_genres readable" on public.app_genres;
create policy "app_genres readable"
  on public.app_genres for select
  using (true);
