-- ============================================================================
-- Atlas — leases (Lease Intelligence)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.leases (
  id            uuid        primary key default gen_random_uuid(),
  property_id   uuid        not null references public.properties(id) on delete cascade,
  user_id       text        not null,                 -- Clerk user id (denormalized for scoping)
  tenant_name   text        not null,
  tenant_email  text,
  unit_number   text,
  monthly_rent  numeric,
  lease_start   date,
  lease_end     date,
  status        text        not null default 'active', -- 'active' | 'expiring_soon' | 'expired'
  created_at    timestamptz not null default now()
);

create index if not exists leases_property_id_idx on public.leases (property_id);
create index if not exists leases_user_id_idx     on public.leases (user_id);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server uses the service-role key which bypasses RLS.
alter table public.leases enable row level security;
