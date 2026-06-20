-- ============================================================================
-- Atlas — store the structured knowledge-base form data per property
-- Run this in the Supabase dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

-- One JSON column holds all the KB editor fields (rent, fees, pet policy, etc.)
-- so the form can be pre-filled on return. The composed text is what gets pushed
-- to the Retell knowledge base.
alter table public.properties
  add column if not exists kb_data jsonb not null default '{}'::jsonb;
