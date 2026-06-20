-- ============================================================================
-- Atlas — subscriptions (Stripe billing)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

create table if not exists public.subscriptions (
  user_id                text        primary key,   -- Clerk user id (one sub per user)
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text,                       -- 'dispatch' | 'lease' | 'full'
  status                 text,                       -- 'active' | 'canceled' | 'past_due' | ...
  units                  integer,                    -- subscribed quantity
  price_id               text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

-- Same security posture as the rest of the app: RLS on (public anon key blocked),
-- the server uses the service-role key which bypasses RLS.
alter table public.subscriptions enable row level security;
