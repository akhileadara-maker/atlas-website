import "server-only";
import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY Supabase client using the SERVICE ROLE (secret) key.
//
// This key bypasses Row Level Security and must NEVER reach the browser.
// The `server-only` import above makes the build fail if this module is ever
// imported into a Client Component, which is our safety net.
//
// All access still goes through server code (Server Actions + the dashboard
// server component) that scopes every query by the Clerk user id. With RLS
// enabled on the table, the public anon key can't touch it directly — only
// this server client can.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
