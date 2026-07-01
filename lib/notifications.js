import "server-only";
import { computeLeaseStatus } from "@/lib/leases";
import { getSupabase } from "@/lib/supabase";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { getNotificationEmail } from "@/lib/profiles";
import { maintenanceRequestEmail, expiringLeasesEmail } from "@/lib/emails";

// Email the landlord about a newly submitted maintenance request. Best-effort:
// callers pass the already-resolved recipient, and a send failure is logged,
// never thrown.
export async function sendMaintenanceRequestEmail({ to, propertyId, propertyName, request, tenantEmail }) {
  if (!isResendConfigured() || !to) return;
  const { subject, html } = maintenanceRequestEmail({ propertyId, propertyName, request, tenantEmail });
  await sendEmail({ to, subject, html });
}

// Check a property's leases and, for any newly within 90 days of expiry (and not
// yet emailed), send the landlord one digest and mark them notified so they
// aren't emailed again on the next page load. A lease that's back to "active"
// (renewed) is reset so a future expiry re-notifies. Fully best-effort.
export async function notifyExpiringLeases({ userId, property, leases }) {
  try {
    if (!isResendConfigured()) return;
    const supabase = getSupabase();
    if (!supabase || !userId || !property) return;

    const toNotify = [];
    const toReset = [];
    for (const lease of leases || []) {
      const status = computeLeaseStatus(lease.lease_end);
      if (status === "expiring_soon" && !lease.expiry_notified_at) toNotify.push(lease);
      else if (status === "active" && lease.expiry_notified_at) toReset.push(lease.id);
    }

    // Clear the flag on renewed leases so they can alert again next time.
    if (toReset.length) {
      await supabase.from("leases").update({ expiry_notified_at: null }).in("id", toReset).eq("user_id", userId);
    }
    if (!toNotify.length) return;

    const to = await getNotificationEmail(userId);
    if (!to) return;

    const { subject, html } = expiringLeasesEmail({
      propertyId: property.id,
      propertyName: property.name,
      leases: toNotify,
    });
    const { sent } = await sendEmail({ to, subject, html });

    // Only mark notified if the email actually went out, so a transient failure
    // simply retries on the next load.
    if (sent) {
      await supabase
        .from("leases")
        .update({ expiry_notified_at: new Date().toISOString() })
        .in("id", toNotify.map((l) => l.id))
        .eq("user_id", userId);
    }
  } catch (e) {
    console.error("notifyExpiringLeases failed:", e.message);
  }
}
