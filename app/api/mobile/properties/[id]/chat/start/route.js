import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { startTenantChat } from "@/lib/services/chat";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await startTenantChat(userId, id, body.email));
}
