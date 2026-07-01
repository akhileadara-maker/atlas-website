import { getSupabase } from "@/lib/supabase";
import { notifyExpiringLeases } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Vercel Cron (see vercel.json): emails every landlord about leases newly
// within 90 days of expiry — no dashboard visit required. Secured by CRON_SECRET,
// which Vercel sends as `Authorization: Bearer <secret>` on scheduled runs.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) return new Response("Database not configured", { status: 500 });

  // Pull every property and every lease once, then group leases per property to
  // avoid a per-property query. The service-role client bypasses RLS, so this
  // spans all landlords.
  const { data: properties, error: propErr } = await supabase
    .from("properties")
    .select("id, name, user_id");
  if (propErr) {
    console.error("cron: failed to load properties:", propErr.message);
    return new Response("Failed to load properties", { status: 500 });
  }

  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, user_id, tenant_name, unit_number, lease_end, expiry_notified_at");

  const leasesByProperty = {};
  for (const lease of leases || []) {
    if (!leasesByProperty[lease.property_id]) leasesByProperty[lease.property_id] = [];
    leasesByProperty[lease.property_id].push(lease);
  }

  // notifyExpiringLeases is best-effort per property (it swallows its own
  // errors), so one landlord's failure never blocks the rest.
  let checked = 0;
  for (const property of properties || []) {
    await notifyExpiringLeases({
      userId: property.user_id,
      property,
      leases: leasesByProperty[property.id] || [],
    });
    checked += 1;
  }

  return Response.json({ ok: true, propertiesChecked: checked });
}
