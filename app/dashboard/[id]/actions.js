"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { saveNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import {
  updateKnowledgeBaseContent,
  updateAgentSystemPrompt,
  updateAgentLanguage,
  deletePropertyAgent,
  startChat,
  sendChatMessage,
} from "@/lib/retell";
import { computeLeaseStatus } from "@/lib/leases";
import { URGENCY_OPTIONS, STATUS_OPTIONS } from "@/lib/maintenance";

const str = (v) => (v == null ? "" : v.toString().trim());

// Build the agent's system prompt — re-injected into Retell on every KB save.
function composeSystemPrompt(propertyName, language) {
  const lines = [
    `You are Atlas, the AI assistant for ${propertyName}.`,
    "You help tenants with questions about their property, lease, policies, and maintenance.",
    "",
    "Rules:",
    "- Answer ONLY using information from the knowledge base. Never guess or make up facts.",
    `- If you don't know the answer, or it isn't in the knowledge base, reply exactly: "I'll flag this for your property manager." and escalate the question to a human.`,
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
    preferred_language: str(formData.get("preferred_language")),
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

  // Push the latest info to the property's Retell agent: refresh the knowledge
  // base content AND re-inject the system prompt so the two stay in sync.
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

export async function sendChat(propertyId, chatId, content) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!chatId || !content?.trim()) return { error: "Message is empty." };

  const message = content.trim();
  try {
    const reply = await sendChatMessage(chatId, message);
    const finalReply = reply || "(The agent didn't return a message.)";

    // Best-effort: log the exchange to the property's conversation history.
    // A logging failure (e.g. table not created yet) never breaks the chat.
    if (supabase && propertyId) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (property) {
        const { error } = await supabase.from("conversations").insert({
          property_id: propertyId,
          user_id: userId,
          tenant_message: message,
          agent_response: finalReply,
        });
        if (error) console.error("conversation log failed:", error.message);
        else revalidatePath(`/dashboard/${propertyId}`);
      }
    }

    return { reply: finalReply };
  } catch (e) {
    return { error: e.message };
  }
}

// Fires the agent's Welcome Node greeting by sending an empty trigger message,
// so the chat shows a greeting before the tenant types. Not logged — it's the
// agent's opening line, not a tenant exchange.
export async function triggerWelcome(chatId) {
  const { userId } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!chatId) return { error: "No chat session." };

  try {
    const reply = await sendChatMessage(chatId, "");
    return { reply: reply || "" };
  } catch (e) {
    return { error: e.message };
  }
}

// ---- Lease Intelligence actions ----

export async function addLease(prevState, formData) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const propertyId = str(formData.get("property_id"));
  const tenant_name = str(formData.get("tenant_name"));
  if (!tenant_name) return { error: "Tenant name is required." };

  // Confirm the property belongs to this user before attaching a lease.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const lease_end = str(formData.get("lease_end")) || null;
  const rent = parseFloat(formData.get("monthly_rent"));

  const { error } = await supabase.from("leases").insert({
    property_id: propertyId,
    user_id: userId,
    tenant_name,
    tenant_email: str(formData.get("tenant_email")) || null,
    unit_number: str(formData.get("unit_number")) || null,
    monthly_rent: Number.isFinite(rent) ? rent : null,
    lease_start: str(formData.get("lease_start")) || null,
    lease_end,
    status: computeLeaseStatus(lease_end),
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteLease(leaseId) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const { data: lease } = await supabase
    .from("leases")
    .select("property_id")
    .eq("id", leaseId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("leases").delete().eq("id", leaseId).eq("user_id", userId);
  if (error) return { error: error.message };

  if (lease?.property_id) revalidatePath(`/dashboard/${lease.property_id}`);
  return { success: true };
}

// Recompute each lease's stored status from its end date. Called automatically
// when the property page is viewed; only writes rows whose status changed.
export async function refreshLeaseStatuses(propertyId) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId || !supabase) return;

  const { data: leases } = await supabase
    .from("leases")
    .select("id, lease_end, status")
    .eq("property_id", propertyId)
    .eq("user_id", userId);

  let changed = false;
  for (const lease of leases || []) {
    const next = computeLeaseStatus(lease.lease_end);
    if (next !== lease.status) {
      await supabase.from("leases").update({ status: next }).eq("id", lease.id).eq("user_id", userId);
      changed = true;
    }
  }
  if (changed) revalidatePath(`/dashboard/${propertyId}`);
}

// ---- Dispatch (maintenance request) actions ----

export async function addMaintenanceRequest(prevState, formData) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const propertyId = str(formData.get("property_id"));
  const title = str(formData.get("title"));
  const description = str(formData.get("description"));
  if (!title) return { error: "A title is required." };

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const urgencyInput = str(formData.get("urgency"));
  const urgency = URGENCY_OPTIONS.includes(urgencyInput) ? urgencyInput : "normal";

  const { error } = await supabase.from("maintenance_requests").insert({
    property_id: propertyId,
    user_id: userId,
    title,
    description: description || null,
    urgency,
    status: "open",
  });
  if (error) return { error: error.message };

  // Best-effort: email the landlord (and keep their notification email fresh).
  try {
    const user = await currentUser();
    const to = user?.emailAddresses?.[0]?.emailAddress;
    if (to) {
      await saveNotificationEmail(userId, to);
      await sendMaintenanceRequestEmail({
        to,
        propertyId,
        propertyName: property.name,
        request: { title, description, urgency },
      });
    }
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteMaintenanceRequest(requestId) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("property_id")
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("maintenance_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  if (request?.property_id) revalidatePath(`/dashboard/${request.property_id}`);
  return { success: true };
}

export async function updateMaintenanceStatus(requestId, status) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };
  if (!STATUS_OPTIONS.includes(status)) return { error: "Invalid status." };

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("property_id")
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  if (request?.property_id) revalidatePath(`/dashboard/${request.property_id}`);
  return { success: true };
}
