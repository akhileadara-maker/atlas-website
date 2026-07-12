"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { computeLeaseStatus } from "@/lib/leases";
import { URGENCY_OPTIONS } from "@/lib/maintenance";
import { getNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { readTenantSession, clearTenantSessionCookie } from "@/lib/tenantSession";
import { startVerifiedTenantChat, sendVerifiedTenantChat } from "@/lib/services/chat";

// Internal: the verified email's leases across all properties. Only ever
// called with a session-verified email (never client input).
export async function lookupTenant(email) {
  const e = (email || "").toString().trim().toLowerCase();
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const { data, error } = await supabase
    .from("leases")
    .select("id, property_id, tenant_name, unit_number, lease_start, lease_end, properties(name, address)")
    .ilike("tenant_email", e)
    .order("lease_end", { ascending: true });

  if (error) {
    console.error("tenant lookup failed:", error.message);
    return { error: "Couldn't look up your lease — please try again." };
  }

  const leases = (data || []).map((l) => ({
    id: l.id,
    propertyId: l.property_id,
    propertyName: l.properties?.name || "Your property",
    propertyAddress: l.properties?.address || null,
    unitNumber: l.unit_number || null,
    leaseStart: l.lease_start,
    leaseEnd: l.lease_end,
    status: computeLeaseStatus(l.lease_end), // computed fresh from today's date
  }));

  return { email: e, leases };
}

// Signs the tenant out (clears the session cookie).
export async function signOutTenant() {
  await clearTenantSessionCookie();
  redirect("/signin");
}

// Submit a maintenance request as a VERIFIED tenant. The email comes from the
// session, never the form; the lease re-check scopes the request.
export async function submitTenantRequest(prevState, formData) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  const email = session.email;

  const propertyId = (formData.get("property_id") || "").toString().trim();
  const title = (formData.get("title") || "").toString().trim();
  const description = (formData.get("description") || "").toString().trim();
  const urgencyInput = (formData.get("urgency") || "").toString().trim();
  const urgency = URGENCY_OPTIONS.includes(urgencyInput) ? urgencyInput : "normal";

  if (!title) return { error: "Please describe the issue." };

  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  // Confirm this verified email has a lease at this property, and grab the
  // landlord (user_id) plus the property name for the notification email.
  const { data: leaseRows } = await supabase
    .from("leases")
    .select("user_id, property_id, properties(name)")
    .ilike("tenant_email", email)
    .eq("property_id", propertyId)
    .limit(1);
  const lease = leaseRows?.[0];
  if (!lease) return { error: "We couldn't match your email to a lease at this property." };

  const { error } = await supabase.from("maintenance_requests").insert({
    property_id: lease.property_id,
    user_id: lease.user_id,
    title,
    description: description || null,
    urgency,
    status: "open",
  });

  if (error) {
    console.error("tenant request failed:", error.message);
    return { error: "Couldn't submit your request — please try again." };
  }

  // Best-effort: email the landlord at their saved notification address.
  try {
    const to = await getNotificationEmail(lease.user_id);
    if (to) {
      await sendMaintenanceRequestEmail({
        to,
        propertyId: lease.property_id,
        propertyName: lease.properties?.name,
        request: { title, description, urgency },
        tenantEmail: email,
      });
    }
  } catch (e) {
    console.error("tenant request email failed:", e.message);
  }

  return { success: true };
}

// Chat actions for the tenant home — identity from the session only.
export async function tenantChatStart(propertyId) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  return startVerifiedTenantChat(session.email, propertyId);
}

export async function tenantChatSend(propertyId, chatId, text) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  return sendVerifiedTenantChat(session.email, propertyId, chatId, text);
}
