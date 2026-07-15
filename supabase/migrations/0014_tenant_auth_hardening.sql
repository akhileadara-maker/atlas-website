-- Tenant auth hardening (run by hand in the Supabase SQL editor).

-- 1) Chat-session binding: every Retell chat is recorded at start and checked
--    on every send, so a chatId can't be replayed into someone else's chat.
--    user_id = the landlord who owns the property; tenant_email is set for
--    verified-tenant chats (null for the landlord test console).
create table if not exists public.chat_sessions (
  chat_id text primary key,
  property_id uuid not null,
  user_id text not null,
  tenant_email text,
  created_at timestamptz not null default now()
);

alter table public.chat_sessions enable row level security;
-- No policies: anon/authenticated denied; the server-side service-role key
-- bypasses RLS. Same posture as every other table.

-- 2) Per-IP rate limiting for OTP requests (fixed one-hour windows).
create table if not exists public.tenant_otp_ips (
  ip text primary key,
  window_start timestamptz not null,
  count int not null default 1
);

alter table public.tenant_otp_ips enable row level security;

-- 3) Atomic attempt counter: increments and returns the new count in one
--    statement, so concurrent guesses can't slip past the cap.
--    Returns null when no code row exists for the email.
create or replace function public.increment_otp_attempts(p_email text)
returns int
language sql
as $$
  update public.tenant_otps
     set attempts = attempts + 1
   where email = p_email
  returning attempts;
$$;
