import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { updateRequestStatus, removeRequest } from "@/lib/services/maintenance";

export const PATCH = withMobileRoute(async (request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await updateRequestStatus(userId, id, body.status);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true }); // propertyId is internal — don't expose
});

export const DELETE = withMobileRoute(async (_request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;

  const result = await removeRequest(userId, id);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true });
});
