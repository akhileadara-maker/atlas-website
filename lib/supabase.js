import "server-only";
import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY Supabase client using the SERVICE ROLE (secret) key.
// The `server-only` import makes the build fail if this is ever imported into a
// Client Component, so the secret can never reach the browser.

let client = null;

// Lazily create the client on FIRST USE (at request time) instead of at import
// time. This is important for the build: if an env var isn't present while
// Next.js is bundling, we don't want `createClient` to throw "supabaseUrl is
// required" and fail the whole build. Returns null when config is missing so
// callers can degrade gracefully.
export function getSupabase() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// True when both required env vars are present.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
