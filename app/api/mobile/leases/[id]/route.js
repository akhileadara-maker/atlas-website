import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { removeLease } from "@/lib/services/leases";

export const DELETE = withMobileRoute(async (_request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;

  const result = await removeLease(userId, id);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true }); // propertyId is internal — don't expose
});
