"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

// Server Action: insert a property for the currently signed-in landlord.
// user_id comes from the trusted Clerk session — never from the form.
export async function addProperty(prevState, formData) {
  const { userId } = await auth();
  if (!userId) return { error: "You must be signed in." };

  const name = (formData.get("name") || "").toString().trim();
  const address = (formData.get("address") || "").toString().trim();
  const unitsRaw = parseInt(formData.get("units"), 10);
  const units = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;

  if (!name) return { error: "Property name is required." };

  const { error } = await supabase.from("properties").insert({
    user_id: userId,
    name,
    address: address || null,
    units,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
