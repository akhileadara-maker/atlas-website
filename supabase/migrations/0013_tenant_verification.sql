-- Tenant verification (run by hand in the Supabase SQL editor).
-- 1) One-time sign-in codes. One row per email; re-requesting a code replaces
--    the row (upsert). Codes are stored as sha256 hashes, never plaintext.
create table if not exists public.tenant_otps (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tenant_otps enable row level security;
-- No policies: anon/authenticated denied; the server-side service-role key
-- bypasses RLS. Same posture as every other table.

-- 2) Tenant identity on logged conversations (verified tenant chats only;
--    the landlord test console leaves this null). Enables the future
--    per-tenant inbox grouping.
alter table public.conversations add column if not exists tenant_email text;
