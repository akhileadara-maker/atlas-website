-- ============================================================================
-- Atlas — track when an expiring-lease alert was emailed (dedupe notifications)
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

alter table public.leases
  add column if not exists expiry_notified_at timestamptz;  -- set when the 90-day alert is sent; null = not yet
