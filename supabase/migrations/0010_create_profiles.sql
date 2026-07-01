-- ============================================================================
-- Atlas — profiles (landlord notification email)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.profiles (
  user_id            text        primary key,   -- Clerk user id (one profile per user)
  notification_email text,                       -- where Atlas sends alerts (from Clerk)
  updated_at         timestamptz not null default now()
);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server uses the service-role key which bypasses RLS.
alter table public.profiles enable row level security;
