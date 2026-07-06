import "server-only";
import { getSupabase } from "@/lib/supabase";

// Store a device's Expo push token for the signed-in landlord. Upsert on the
// token so a device that re-registers (or switches accounts) moves cleanly.
export async function registerPushToken(userId, { expoPushToken, platform }) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const token = typeof expoPushToken === "string" ? expoPushToken.trim() : "";
  if (!token.startsWith("ExponentPushToken[")) return { error: "Invalid push token." };

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: typeof platform === "string" ? platform : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" }
  );
  if (error) return { error: error.message };

  return { success: true };
}
