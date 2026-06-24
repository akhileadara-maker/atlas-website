-- ============================================================================
-- Atlas — Tenant AI conversation log
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.conversations (
  id              uuid        primary key default gen_random_uuid(),
  property_id     uuid        not null references public.properties(id) on delete cascade,
  user_id         text        not null,                 -- Clerk user id (denormalized for scoping)
  tenant_message  text,
  agent_response  text,
  created_at      timestamptz not null default now()
);

create index if not exists conversations_property_id_idx on public.conversations (property_id);
create index if not exists conversations_user_id_idx     on public.conversations (user_id);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server uses the service-role key which bypasses RLS.
alter table public.conversations enable row level security;
