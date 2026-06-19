-- ============================================================================
-- Atlas — add Retell agent + knowledge base ids to properties
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

alter table public.properties
  add column if not exists retell_agent_id text,
  add column if not exists retell_kb_id    text;
