"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { createPropertyAgent } from "@/lib/retell";

// Server Action: insert a property for the currently signed-in landlord, then
// (best-effort) spin up its Retell knowledge base + chat agent.
// user_id comes from the trusted Clerk session — never from the form.
export async function addProperty(prevState, formData) {
  const { userId } = await auth();
  if (!userId) return { error: "You must be signed in." };

  const supabase = getSupabase();
  if (!supabase) {
    return { error: "The database isn't configured. Set the Supabase environment variables." };
  }

  const name = (formData.get("name") || "").toString().trim();
  const address = (formData.get("address") || "").toString().trim();
  const unitsRaw = parseInt(formData.get("units"), 10);
  const units = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;

  if (!name) return { error: "Property name is required." };

  // 1) Save the property first so a Retell hiccup can never lose the data.
  const { data: row, error } = await supabase
    .from("properties")
    .insert({ user_id: userId, name, address: address || null, units })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // 2) Best-effort: create the property's Retell agent + KB, store their ids.
  //    On failure the property is still saved and the card shows "Agent pending".
  try {
    const { agentId, kbId } = await createPropertyAgent({ name, address });
    await supabase
      .from("properties")
      .update({ retell_agent_id: agentId, retell_kb_id: kbId })
      .eq("id", row.id);
  } catch (e) {
    console.error("Retell agent creation failed:", e.message);
  }

  revalidatePath("/dashboard");
  return { success: true };
}
