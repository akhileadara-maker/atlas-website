import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { startTenantChat } from "@/lib/services/chat";

export const POST = withMobileRoute(async (request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await startTenantChat(userId, id, body.email));
});
