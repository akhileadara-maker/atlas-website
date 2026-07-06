import "server-only";
import { getSupabase } from "@/lib/supabase";

// Expo push HTTP API — token-based, no secret required for basic sends.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Send a push to every device registered for a landlord. Best-effort like the
// email path: never throws. Returns true when Expo accepted at least one
// message ticket (notifyExpiringLeases' dedupe flag depends on this). Tokens
// Expo reports as DeviceNotRegistered are pruned.
export async function sendPushToUser(userId, { title, body, data }) {
  try {
    const supabase = getSupabase();
    if (!supabase || !userId) return false;

    const { data: rows, error } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", userId);
    if (error || !rows?.length) return false;

    const messages = rows.map((r) => ({
      to: r.expo_push_token,
      title,
      body,
      data,
      sound: "default",
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("expo push send failed:", res.status, await res.text());
      return false;
    }

    const { data: tickets } = await res.json();
    let accepted = false;
    const dead = [];
    (tickets || []).forEach((ticket, i) => {
      if (ticket.status === "ok") accepted = true;
      else if (ticket.details?.error === "DeviceNotRegistered") dead.push(messages[i].to);
    });

    if (dead.length) {
      await supabase.from("push_tokens").delete().in("expo_push_token", dead);
    }

    return accepted;
  } catch (e) {
    console.error("sendPushToUser failed:", e.message);
    return false;
  }
}
