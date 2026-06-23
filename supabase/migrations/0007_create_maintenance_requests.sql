-- ============================================================================
-- Atlas — maintenance requests (Dispatch)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.maintenance_requests (
  id           uuid        primary key default gen_random_uuid(),
  property_id  uuid        not null references public.properties(id) on delete cascade,
  user_id      text        not null,                 -- Clerk user id (denormalized for scoping)
  title        text        not null,
  description  text,
  urgency      text        not null default 'normal', -- 'urgent' | 'normal' | 'low'
  status       text        not null default 'open',   -- 'open' | 'in_progress' | 'resolved'
  created_at   timestamptz not null default now()
);

create index if not exists maintenance_property_id_idx on public.maintenance_requests (property_id);
create index if not exists maintenance_user_id_idx     on public.maintenance_requests (user_id);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server uses the service-role key which bypasses RLS.
alter table public.maintenance_requests enable row level security;
