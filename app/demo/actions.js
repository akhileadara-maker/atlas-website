"use server";

import { getSupabase } from "@/lib/supabase";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Public marketing waitlist sign-up (no auth). Saves name + email to Supabase.
export async function joinWaitlist(prevState, formData) {
  const name = (formData.get("name") || "").toString().trim();
  const email = (formData.get("email") || "").toString().trim().toLowerCase();

  if (!isEmail(email)) return { error: "Please enter a valid email address." };

  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  // Upsert so a repeat sign-up updates the name instead of erroring on the unique email.
  const { error } = await supabase
    .from("waitlist")
    .upsert({ name: name || null, email }, { onConflict: "email" });

  if (error) {
    console.error("waitlist sign-up failed:", error.message);
    return { error: "Couldn't join the waitlist — please try again." };
  }

  return { success: true };
}
