import "server-only";
import { getSupabase } from "@/lib/supabase";
import {
  createPropertyAgent,
  updateKnowledgeBaseContent,
  updateAgentSystemPrompt,
  updateAgentLanguage,
  deletePropertyAgent,
} from "@/lib/retell";

const str = (v) => (v == null ? "" : v.toString().trim());

// Build the agent's system prompt — re-injected into Retell on every KB save.
// (Moved verbatim from app/dashboard/[id]/actions.js.)
function composeSystemPrompt(propertyName, language) {
  const lines = [
    `You are Atlas, the AI assistant for ${propertyName}.`,
    "You help tenants with questions about their property, lease, policies, and maintenance.",
    "",
    "Rules:",
    "- Answer general property questions ONLY using information from the knowledge base. Never guess or make up facts.",
    "- If the tenant's own lease details are provided to you in this conversation, use them to answer their personal questions (their lease end date, monthly rent, unit, and lease status).",
    `- If you don't know the answer, or it isn't in the knowledge base or the tenant's lease details, reply exactly: "I'll flag this for your property manager." and escalate the question to a human.`,
    "- Be professional, but warm and friendly.",
    "- Always reply in the same language the tenant writes in.",
  ];
  if (language) {
    lines.push(
      `- This property's preferred language is ${language}; default to it when the tenant's language is unclear.`
    );
  }
  return lines.join("\n");
}

// Build the plain-text document that gets pushed to the Retell knowledge base.
// (Moved verbatim from app/dashboard/[id]/actions.js.)
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

// Insert a property for this landlord, then (best-effort) spin up its Retell
// knowledge base + chat agent. On Retell failure the property is still saved
// and clients show "Agent pending".
export async function createProperty(userId, { name, address, units }) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "The database isn't configured. Set the Supabase environment variables." };
  }

  const cleanName = str(name);
  const cleanAddress = str(address);
  const unitsRaw = parseInt(units, 10);
  const cleanUnits = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;

  if (!cleanName) return { error: "Property name is required." };

  const { data: row, error } = await supabase
    .from("properties")
    .insert({ user_id: userId, name: cleanName, address: cleanAddress || null, units: cleanUnits })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    const { agentId, kbId } = await createPropertyAgent({ name: cleanName, address: cleanAddress });
    await supabase
      .from("properties")
      .update({ retell_agent_id: agentId, retell_kb_id: kbId })
      .eq("id", row.id);
  } catch (e) {
    console.error("Retell agent creation failed:", e.message);
  }

  return { success: true, id: row.id };
}

export async function updatePropertyDetails(userId, id, { name, address, units }) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const cleanName = str(name);
  const cleanAddress = str(address);
  const unitsRaw = parseInt(units, 10);
  const cleanUnits = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;
  if (!cleanName) return { error: "Property name is required." };

  const { error } = await supabase
    .from("properties")
    .update({ name: cleanName, address: cleanAddress || null, units: cleanUnits })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true };
}

// Deletes the property (children cascade in Postgres) after best-effort Retell
// agent + KB teardown so nothing is orphaned.
export async function deletePropertyById(userId, id) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("retell_agent_id, retell_kb_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (property) {
    await deletePropertyAgent({
      agentId: property.retell_agent_id,
      kbId: property.retell_kb_id,
    });
  }

  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true };
}

// Persists the structured KB fields, then pushes the latest info to the
// property's Retell agent: KB content + system prompt + language, so the agent
// never drifts from what the landlord saved.
export async function saveKnowledgeBase(userId, id, input) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const kb = {
    monthly_rent: str(input.monthly_rent),
    late_fee: str(input.late_fee),
    grace_period: str(input.grace_period),
    pet_allowed: str(input.pet_allowed) === "yes" ? "yes" : "no",
    pet_deposit: str(input.pet_deposit),
    pet_monthly_fee: str(input.pet_monthly_fee),
    maintenance_contact: str(input.maintenance_contact),
    office_hours: str(input.office_hours),
    parking_policy: str(input.parking_policy),
    custom_notes: str(input.custom_notes),
    preferred_language: str(input.preferred_language),
  };

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  const { error: upErr } = await supabase
    .from("properties")
    .update({ kb_data: kb })
    .eq("id", id)
    .eq("user_id", userId);
  if (upErr) return { error: upErr.message };

  if (property.retell_kb_id || property.retell_agent_id) {
    try {
      if (property.retell_kb_id) {
        await updateKnowledgeBaseContent(
          property.retell_kb_id,
          `${property.name} — property info`.slice(0, 60),
          composeKbText(property, kb)
        );
      }
      if (property.retell_agent_id) {
        await updateAgentSystemPrompt(
          property.retell_agent_id,
          composeSystemPrompt(property.name, kb.preferred_language)
        );
        await updateAgentLanguage(property.retell_agent_id, kb.preferred_language);
      }
    } catch (e) {
      return { error: "Saved your info, but updating the AI agent failed: " + e.message };
    }
  }

  return { success: true };
}
