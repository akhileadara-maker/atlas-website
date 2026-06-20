"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  updateKnowledgeBaseContent,
  deletePropertyAgent,
  startChat,
  sendChatMessage,
} from "@/lib/retell";

const str = (v) => (v == null ? "" : v.toString().trim());

// Build the plain-text document that gets pushed to the Retell knowledge base.
function composeKbText(property, kb) {
  const lines = [`Property: ${property.name}`];
  if (property.address) lines.push(`Address: ${property.address}`);
  lines.push(`Number of units: ${property.units}`, "");

  if (kb.monthly_rent) lines.push(`Monthly rent: ${kb.monthly_rent}`);
  if (kb.late_fee || kb.grace_period) {
    lines.push(
      `Late fee: ${kb.late_fee || "N/A"}` +
        (kb.grace_period ? ` (after a ${kb.grace_period}-day grace period)` : "")
    );
  }
  const petsAllowed = kb.pet_allowed === "yes";
  let pets = `Pet policy: ${petsAllowed ? "Pets allowed" : "No pets allowed"}`;
  if (petsAllowed) {
    if (kb.pet_deposit) pets += `; pet deposit ${kb.pet_deposit}`;
    if (kb.pet_monthly_fee) pets += `; monthly pet fee ${kb.pet_monthly_fee}`;
  }
  lines.push(pets);
  if (kb.maintenance_contact) lines.push(`Maintenance emergency contact: ${kb.maintenance_contact}`);
  if (kb.office_hours) lines.push(`Office hours: ${kb.office_hours}`);
  if (kb.parking_policy) lines.push(`Parking policy: ${kb.parking_policy}`);
  if (kb.custom_notes) lines.push(`Additional rules and notes: ${kb.custom_notes}`);
  return lines.join("\n");
}

async function requireUserAndDb() {
  const { userId } = await auth();
  const supabase = getSupabase();
  return { userId, supabase };
}

export async function updateProperty(prevState, formData) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  const address = str(formData.get("address"));
  const unitsRaw = parseInt(formData.get("units"), 10);
  const units = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;
  if (!name) return { error: "Property name is required." };

  const { error } = await supabase
    .from("properties")
    .update({ name, address: address || null, units })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProperty(id) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("retell_agent_id, retell_kb_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  // Best-effort: tear down the Retell agent + KB so nothing is orphaned.
  if (property) {
    await deletePropertyAgent({
      agentId: property.retell_agent_id,
      kbId: property.retell_kb_id,
    });
  }

  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function saveKnowledgeBase(prevState, formData) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const id = str(formData.get("id"));
  const kb = {
    monthly_rent: str(formData.get("monthly_rent")),
    late_fee: str(formData.get("late_fee")),
    grace_period: str(formData.get("grace_period")),
    pet_allowed: str(formData.get("pet_allowed")) === "yes" ? "yes" : "no",
    pet_deposit: str(formData.get("pet_deposit")),
    pet_monthly_fee: str(formData.get("pet_monthly_fee")),
    maintenance_contact: str(formData.get("maintenance_contact")),
    office_hours: str(formData.get("office_hours")),
    parking_policy: str(formData.get("parking_policy")),
    custom_notes: str(formData.get("custom_notes")),
  };

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  // Persist the structured fields so the form pre-fills next time.
  const { error: upErr } = await supabase
    .from("properties")
    .update({ kb_data: kb })
    .eq("id", id)
    .eq("user_id", userId);
  if (upErr) return { error: upErr.message };

  // Push the composed text into the property's Retell knowledge base.
  if (property.retell_kb_id) {
    try {
      await updateKnowledgeBaseContent(
        property.retell_kb_id,
        `${property.name} — property info`.slice(0, 60),
        composeKbText(property, kb)
      );
    } catch (e) {
      return { error: "Saved your info, but updating the AI knowledge base failed: " + e.message };
    }
  }

  revalidatePath(`/dashboard/${id}`);
  return { success: true };
}

// ---- Chat widget actions ----

export async function startChatSession(propertyId) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("retell_agent_id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .single();
  if (!property?.retell_agent_id) return { error: "This property doesn't have an agent yet." };

  try {
    const chatId = await startChat(property.retell_agent_id);
    return { chatId };
  } catch (e) {
    return { error: e.message };
  }
}

export async function sendChat(chatId, content) {
  const { userId } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!chatId || !content?.trim()) return { error: "Message is empty." };

  try {
    const reply = await sendChatMessage(chatId, content.trim());
    return { reply: reply || "(The agent didn't return a message.)" };
  } catch (e) {
    return { error: e.message };
  }
}
