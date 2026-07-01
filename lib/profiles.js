import "server-only";
import { getSupabase } from "@/lib/supabase";

// One row per Clerk user (profiles table, migration 0010). Stores where Atlas
// should send this landlord's notification emails. All best-effort — a profiles
// read/write must never break the flow that called it.

export async function getNotificationEmail(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("notification_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getNotificationEmail failed:", error.message);
    return null;
  }
  return data?.notification_email || null;
}

export async function saveNotificationEmail(userId, email) {
  const supabase = getSupabase();
  if (!supabase || !userId || !email) return;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, notification_email: email, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) console.error("saveNotificationEmail failed:", error.message);
}
