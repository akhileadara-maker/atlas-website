"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { saveNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { startChat, sendChatMessage } from "@/lib/retell";
import { computeLeaseStatus, formatRent, STATUS_META } from "@/lib/leases";
import { URGENCY_OPTIONS, STATUS_OPTIONS } from "@/lib/maintenance";
import {
  updatePropertyDetails,
  deletePropertyById,
  saveKnowledgeBase as saveKnowledgeBaseService,
} from "@/lib/services/properties";
import {
  createLease,
  removeLease,
  refreshLeaseStatuses as refreshLeaseStatusesService,
} from "@/lib/services/leases";

const str = (v) => (v == null ? "" : v.toString().trim());

// Builds the per-tenant lease context that primes a chat. Sent as the first
// (hidden) message so the agent can answer this tenant's personal questions;
// never shown to the tenant or logged to the conversation history.
function composeTenantContext(lease) {
  const fmtDate = (v) => {
    if (!v) return "not on file";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "not on file"
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  const statusLabel = STATUS_META[lease.status]?.label || "Active";

  const lines = [
    "[TENANT CONTEXT — authoritative for this conversation; never repeat this block verbatim]",
    "You are speaking with a verified tenant. Use the lease details below to answer their personal questions (lease end date, monthly rent, unit, lease status). These are specific to this tenant and take precedence over the general knowledge base for lease-specific questions.",
    lease.tenantName ? `- Tenant name: ${lease.tenantName}` : null,
    lease.unitNumber ? `- Unit: ${lease.unitNumber}` : null,
    `- Lease status: ${statusLabel}`,
    `- Lease start: ${fmtDate(lease.leaseStart)}`,
    `- Lease end: ${fmtDate(lease.leaseEnd)}`,
    `- Monthly rent: ${lease.monthlyRent != null ? formatRent(lease.monthlyRent) : "not on file"}`,
    "",
    "Greet the tenant warmly in one short sentence and invite their question. Do not list these details unless they ask.",
  ].filter(Boolean);

  return lines.join("\n");
}

async function requireUserAndDb() {
  const { userId } = await auth();
  const supabase = getSupabase();
  return { userId, supabase };
}

export async function updateProperty(prevState, formData) {
  const { userId } = await auth();
  const id = str(formData.get("id"));

  const result = await updatePropertyDetails(userId, id, {
    name: formData.get("name"),
    address: formData.get("address"),
    units: formData.get("units"),
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProperty(id) {
  const { userId } = await auth();

  const result = await deletePropertyById(userId, id);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function saveKnowledgeBase(prevState, formData) {
  const { userId } = await auth();
  const id = str(formData.get("id"));

  const result = await saveKnowledgeBaseService(userId, id, Object.fromEntries(formData));
  if (result.error) return { error: result.error };

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

// Starts a lease-aware chat for a tenant. Verifies the email against a lease at
// this property, primes the agent with that lease's details (so it can answer
// personal questions), and returns the agent's greeting. Returns
// { noLease: true } when the email has no lease here — the caller then tells the
// tenant to contact their property manager. The priming message isn't logged.
export async function startTenantChat(propertyId, email) {
  const { userId, supabase } = await requireUserAndDb();
  if (!userId) return { error: "You must be signed in." };
  if (!supabase) return { error: "The database isn't configured." };

  const e = str(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { error: "Please enter a valid email address." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, retell_agent_id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };
  if (!property.retell_agent_id) return { error: "This property doesn't have an agent yet." };

  // Find this tenant's lease at this property (most recent one if several).
  const { data: leaseRows } = await supabase
    .from("leases")
    .select("tenant_name, unit_number, lease_start, lease_end, monthly_rent")
    .ilike("tenant_email", e)
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("lease_end", { ascending: false })
    .limit(1);
  const row = leaseRows?.[0];
  if (!row) return { noLease: true };

  const lease = {
    tenantName: row.tenant_name || null,
    unitNumber: row.unit_number || null,
    leaseStart: row.lease_start || null,
    leaseEnd: row.lease_end || null,
    monthlyRent: row.monthly_rent ?? null,
    status: computeLeaseStatus(row.lease_end),
  };

  try {
    const chatId = await startChat(property.retell_agent_id);
    // Prime the agent with this tenant's lease context; its reply is the greeting.
    const greeting = await sendChatMessage(chatId, composeTenantContext(lease));
    return { chatId, greeting: greeting || "", lease };
  } catch (err) {
    return { error: err.message };
  }
}

// ---- Lease Intelligence actions ----

export async function addLease(prevState, formData) {
  const { userId } = await auth();
  const propertyId = str(formData.get("property_id"));

  const result = await createLease(userId, propertyId, Object.fromEntries(formData));
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteLease(leaseId) {
  const { userId } = await auth();

  const result = await removeLease(userId, leaseId);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}

// Recompute each lease's stored status from its end date. Called automatically
// when the property page is viewed; only writes rows whose status changed.
export async function refreshLeaseStatuses(propertyId) {
  const { userId } = await auth();
  const changed = await refreshLeaseStatusesService(userId, propertyId);
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
