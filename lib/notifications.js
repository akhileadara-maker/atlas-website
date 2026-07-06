import "server-only";
import { computeLeaseStatus } from "@/lib/leases";
import { getSupabase } from "@/lib/supabase";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { getNotificationEmail } from "@/lib/profiles";
import { maintenanceRequestEmail, expiringLeasesEmail } from "@/lib/emails";
import { sendPushToUser } from "@/lib/push";

// Email the landlord about a newly submitted maintenance request. Best-effort:
// callers pass the already-resolved recipient, and a send failure is logged,
// never thrown.
export async function sendMaintenanceRequestEmail({ to, propertyId, propertyName, request, tenantEmail }) {
  if (!isResendConfigured() || !to) return;
  const { subject, html } = maintenanceRequestEmail({ propertyId, propertyName, request, tenantEmail });
  await sendEmail({ to, subject, html });
}

// Check a property's leases and, for any newly within 90 days of expiry (and
// not yet notified), alert the landlord by email digest AND Expo push, then
// mark them notified so they alert only once. A lease that's back to "active"
// (renewed) is reset so a future expiry re-notifies. Fully best-effort.
// The notified flag is set when EITHER channel succeeds (developer-approved:
// previously email-only, which starved the push path whenever email delivery
// was unavailable).
export async function notifyExpiringLeases({ userId, property, leases }) {
  try {
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

    // Email digest — unchanged behavior; still requires Resend + a recipient.
    let emailSent = false;
    if (isResendConfigured()) {
      const to = await getNotificationEmail(userId);
      if (to) {
        const { subject, html } = expiringLeasesEmail({
          propertyId: property.id,
          propertyName: property.name,
          leases: toNotify,
        });
        const { sent } = await sendEmail({ to, subject, html });
        emailSent = sent;
      }
    }

    // Expo push alongside the email (added for the mobile app).
    const pushSent = await sendPushToUser(userId, {
      title: "Leases expiring soon",
      body: `${property.name}: ${toNotify.length} lease${toNotify.length === 1 ? "" : "s"} within 90 days`,
      data: { url: `/property/${property.id}` },
    });

    // Only mark notified if at least one channel got through, so a transient
    // failure simply retries on the next run.
    if (emailSent || pushSent) {
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
