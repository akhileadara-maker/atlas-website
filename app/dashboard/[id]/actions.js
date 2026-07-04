"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { createRequest, updateRequestStatus, removeRequest } from "@/lib/services/maintenance";
import {
  startChatSession as startChatSessionService,
  sendChat as sendChatService,
  startTenantChat as startTenantChatService,
} from "@/lib/services/chat";

const str = (v) => (v == null ? "" : v.toString().trim());

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
  const { userId } = await auth();
  return startChatSessionService(userId, propertyId);
}

export async function sendChat(propertyId, chatId, content) {
  const { userId } = await auth();

  const result = await sendChatService(userId, propertyId, chatId, content);
  if (result.error) return { error: result.error };

  if (result.logged) revalidatePath(`/dashboard/${propertyId}`);
  return { reply: result.reply };
}

export async function startTenantChat(propertyId, email) {
  const { userId } = await auth();
  return startTenantChatService(userId, propertyId, email);
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
  const { userId } = await auth();
  const propertyId = str(formData.get("property_id"));

  // Resolve the landlord's email up front (best-effort) so the service can
  // send the notification; a Clerk hiccup must never block the request.
  let landlordEmail = null;
  try {
    const user = await currentUser();
    landlordEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  const result = await createRequest(
    userId,
    propertyId,
    {
      title: formData.get("title"),
      description: formData.get("description"),
      urgency: formData.get("urgency"),
    },
    { landlordEmail }
  );
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteMaintenanceRequest(requestId) {
  const { userId } = await auth();

  const result = await removeRequest(userId, requestId);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}

export async function updateMaintenanceStatus(requestId, status) {
  const { userId } = await auth();

  const result = await updateRequestStatus(userId, requestId, status);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}
