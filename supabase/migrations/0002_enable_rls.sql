-- ============================================================================
-- Atlas — enable Row Level Security on properties
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

-- Turn on RLS. With RLS enabled and NO policies, the public anon key is denied
-- all access to this table. The app's server code uses the SERVICE ROLE key,
-- which bypasses RLS — so the dashboard and the "Add Property" action keep
-- working, but nobody can read or write the table with the public key.
alter table public.properties enable row level security;

-- (No policies are needed for the service-role setup. If you ever switch to the
--  Clerk-native client-side approach, add a per-user policy keyed on
--  auth.jwt() ->> 'sub' = user_id.)
