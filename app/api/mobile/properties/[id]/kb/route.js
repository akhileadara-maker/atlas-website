import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { saveKnowledgeBase } from "@/lib/services/properties";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await saveKnowledgeBase(userId, id, body));
}
