import "server-only";
import { getSupabase } from "@/lib/supabase";

// Total units a landlord is billed on = sum of units across their properties.
export async function getUnitCount(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return 0;
  const { data } = await supabase.from("properties").select("units").eq("user_id", userId);
  return (data || []).reduce((sum, p) => sum + (p.units || 0), 0);
}

// The user's current subscription row (or null).
export async function getSubscription(userId) {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export function isActive(sub) {
  return Boolean(sub && (sub.status === "active" || sub.status === "trialing"));
}
