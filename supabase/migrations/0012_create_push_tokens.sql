-- Push notification tokens for the mobile app (Expo). One row per device
-- token; a device re-registering (or switching accounts) moves via the
-- upsert on expo_push_token. Run by hand in the Supabase SQL editor.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  expo_push_token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- No policies: anon/authenticated denied; the server-side service-role key
-- bypasses RLS — same posture as every other table.
