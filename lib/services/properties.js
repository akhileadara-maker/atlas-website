import "server-only";
import { getSupabase } from "@/lib/supabase";
import { computeLeaseStatus } from "@/lib/leases";
import {
  createPropertyAgent,
  updateKnowledgeBaseContent,
  updateAgentSystemPrompt,
  updateAgentLanguage,
  deletePropertyAgent,
} from "@/lib/retell";
import { notifyExpiringLeases } from "@/lib/notifications";

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
    "- If a tenant asks about several things at once, answer each part you have information for, and only escalate the specific parts you don't. Never refuse the whole question because one part is missing.",
    `- For any part you cannot answer from the knowledge base or the tenant's lease details, tell the tenant you'll flag that specific part for the property manager (for example: "For the pet deposit, I'll flag this for your property manager."). Do not guess.`,
    "- If the tenant describes an urgent safety emergency (fire, flood, lockout, or similar) and the knowledge base includes emergency instructions, give those instructions first and clearly, before anything else.",
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
  if (kb.guest_policy) lines.push(`Guest policy: ${kb.guest_policy}`);
  if (kb.lease_renewal_policy) lines.push(`Lease renewal policy: ${kb.lease_renewal_policy}`);
  if (kb.subletting_policy) lines.push(`Subletting policy: ${kb.subletting_policy}`);
  if (kb.break_lease_policy) lines.push(`Break-lease / early termination policy: ${kb.break_lease_policy}`);
  if (kb.move_out_process) lines.push(`Move-out and deposit return process: ${kb.move_out_process}`);
  if (kb.emergency_instructions) lines.push(`Emergency instructions: ${kb.emergency_instructions}`);
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

// One property (incl. kb_data) for the mobile detail screen. Mirrors the web
// property page's side effect: best-effort expiring-lease digest, deduped via
// expiry_notified_at so it never double-sends.
export async function getProperty(userId, id) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, user_id, tenant_name, unit_number, lease_end, expiry_notified_at")
    .eq("property_id", id)
    .eq("user_id", userId);
  await notifyExpiringLeases({ userId, property, leases: leases || [] });

  return { property };
}

// Persists the structured KB fields, then pushes the latest info to the
// property's Retell agent: KB content + system prompt + language, so the agent
// never drifts from what the landlord saved.
export async function saveKnowledgeBase(userId, id, input) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  // Fetch the property first so we can merge over its existing kb_data.
  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  // The text KB fields this form manages. A field is written ONLY when its key
  // is present in `input`, so a save that omits a field (e.g. the mobile card,
  // which doesn't submit the newer policy fields) preserves the stored value
  // instead of clearing it. `pet_allowed` (a yes/no select) is handled below.
  const KB_TEXT_FIELDS = [
    "monthly_rent",
    "late_fee",
    "grace_period",
    "pet_deposit",
    "pet_monthly_fee",
    "maintenance_contact",
    "office_hours",
    "parking_policy",
    "custom_notes",
    "preferred_language",
    "guest_policy",
    "lease_renewal_policy",
    "subletting_policy",
    "break_lease_policy",
    "move_out_process",
    "emergency_instructions",
  ];

  const kb = { ...(property.kb_data || {}) };
  for (const field of KB_TEXT_FIELDS) {
    if (field in input) kb[field] = str(input[field]);
  }
  if ("pet_allowed" in input) {
    kb.pet_allowed = str(input.pet_allowed) === "yes" ? "yes" : "no";
  }

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

// Everything the dashboard (web or mobile) shows: the four stat cards plus the
// property list with per-property lease/open-request counts. Mirrors the
// queries in app/dashboard/page.js (which stays as-is per the design doc).
export async function getDashboardData(userId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: propertyRows, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  const properties = propertyRows || [];

  const [leaseRes, reqRes] = await Promise.all([
    supabase.from("leases").select("property_id, lease_end").eq("user_id", userId),
    supabase.from("maintenance_requests").select("property_id, status").eq("user_id", userId),
  ]);
  const leases = leaseRes.data || [];
  const requests = reqRes.data || [];

  const leasesByProperty = {};
  for (const l of leases) leasesByProperty[l.property_id] = (leasesByProperty[l.property_id] || 0) + 1;
  const openReqByProperty = {};
  for (const r of requests) {
    if (r.status !== "resolved") openReqByProperty[r.property_id] = (openReqByProperty[r.property_id] || 0) + 1;
  }

  return {
    stats: {
      totalUnits: properties.reduce((sum, p) => sum + (p.units || 0), 0),
      activeLeases: leases.filter((l) => computeLeaseStatus(l.lease_end) === "active").length,
      openRequests: requests.filter((r) => r.status !== "resolved").length,
      expiringSoon: leases.filter((l) => computeLeaseStatus(l.lease_end) === "expiring_soon").length,
    },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      units: p.units || 0,
      created_at: p.created_at,
      agentReady: Boolean(p.retell_agent_id),
      leaseCount: leasesByProperty[p.id] || 0,
      openRequestCount: openReqByProperty[p.id] || 0,
    })),
  };
}
