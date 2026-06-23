-- ============================================================================
-- Atlas — marketing waitlist (trial sign-ups)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.waitlist (
  id          uuid        primary key default gen_random_uuid(),
  name        text,
  email       text        not null unique,
  created_at  timestamptz not null default now()
);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server action uses the service-role key which bypasses RLS.
alter table public.waitlist enable row level security;
