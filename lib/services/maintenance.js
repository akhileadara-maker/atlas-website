import "server-only";
import { getSupabase } from "@/lib/supabase";
import { saveNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { URGENCY_OPTIONS, STATUS_OPTIONS } from "@/lib/maintenance";

const str = (v) => (v == null ? "" : v.toString().trim());

// Insert a maintenance request, then best-effort email the landlord (and keep
// their notification email fresh). An email failure never fails the request.
export async function createRequest(userId, propertyId, { title, description, urgency }, { landlordEmail } = {}) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const cleanTitle = str(title);
  const cleanDescription = str(description);
  if (!cleanTitle) return { error: "A title is required." };

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const urgencyInput = str(urgency);
  const cleanUrgency = URGENCY_OPTIONS.includes(urgencyInput) ? urgencyInput : "normal";

  const { error } = await supabase.from("maintenance_requests").insert({
    property_id: propertyId,
    user_id: userId,
    title: cleanTitle,
    description: cleanDescription || null,
    urgency: cleanUrgency,
    status: "open",
  });
  if (error) return { error: error.message };

  try {
    if (landlordEmail) {
      await saveNotificationEmail(userId, landlordEmail);
      await sendMaintenanceRequestEmail({
        to: landlordEmail,
        propertyId,
        propertyName: property.name,
        request: { title: cleanTitle, description: cleanDescription, urgency: cleanUrgency },
      });
    }
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  return { success: true };
}

export async function updateRequestStatus(userId, requestId, status) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
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

  return { success: true, propertyId: request?.property_id || null };
}

export async function removeRequest(userId, requestId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
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

  return { success: true, propertyId: request?.property_id || null };
}
