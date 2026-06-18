-- ============================================================================
-- Atlas — properties table
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.properties (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,                 -- Clerk user id (e.g. "user_2abc…")
  name        text        not null,
  address     text,
  units       integer     not null default 0,
  created_at  timestamptz not null default now()
);

-- Fast lookups of a landlord's own properties.
create index if not exists properties_user_id_idx
  on public.properties (user_id);


-- ============================================================================
-- SECURITY — read this.
-- The app talks to Supabase with the PUBLIC anon key. All access goes through
-- server-side code that scopes every query by the Clerk user id, so the app is
-- safe as written. But because the anon key is public and RLS is OFF below,
-- someone could query this table directly via the public API.
--
-- For production, harden it one of two ways:
--
--   (A) Server-only secret key (simplest):
--       - Add SUPABASE_SECRET_KEY (sb_secret_… / service role) to .env.local,
--         switch lib/supabase.js to use it, then enable RLS with a deny-all
--         default (the secret key bypasses RLS):
--           alter table public.properties enable row level security;
--
--   (B) Clerk-native RLS (per-user policies enforced by the database):
--       - Set up the Clerk ⇄ Supabase integration, then:
--           alter table public.properties enable row level security;
--           create policy "own rows" on public.properties
--             for all
--             using  ((auth.jwt() ->> 'sub') = user_id)
--             with check ((auth.jwt() ->> 'sub') = user_id);
-- ============================================================================
