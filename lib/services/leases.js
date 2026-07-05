import "server-only";
import { getSupabase } from "@/lib/supabase";
import { computeLeaseStatus } from "@/lib/leases";

const str = (v) => (v == null ? "" : v.toString().trim());

export async function createLease(userId, propertyId, fields) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const tenant_name = str(fields.tenant_name);
  if (!tenant_name) return { error: "Tenant name is required." };

  // Confirm the property belongs to this user before attaching a lease.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const lease_end = str(fields.lease_end) || null;
  const rent = parseFloat(fields.monthly_rent);

  const { error } = await supabase.from("leases").insert({
    property_id: propertyId,
    user_id: userId,
    tenant_name,
    tenant_email: str(fields.tenant_email) || null,
    unit_number: str(fields.unit_number) || null,
    monthly_rent: Number.isFinite(rent) ? rent : null,
    lease_start: str(fields.lease_start) || null,
    lease_end,
    status: computeLeaseStatus(lease_end),
  });
  if (error) return { error: error.message };

  return { success: true };
}

export async function removeLease(userId, leaseId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: lease } = await supabase
    .from("leases")
    .select("property_id")
    .eq("id", leaseId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("leases").delete().eq("id", leaseId).eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true, propertyId: lease?.property_id || null };
}

// Recompute each lease's stored status from its end date; only writes rows
// whose status changed. Returns true if anything changed.
export async function refreshLeaseStatuses(userId, propertyId) {
  if (!userId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

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
  return changed;
}

// Leases for one property, statuses refreshed first so badges are always
// current (mirrors what the web property page does via refreshLeaseStatuses).
export async function listLeases(userId, propertyId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  await refreshLeaseStatuses(userId, propertyId);

  const { data: leases, error } = await supabase
    .from("leases")
    .select("*")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("lease_end", { ascending: true });
  if (error) return { error: error.message };

  return { leases: leases || [] };
}
