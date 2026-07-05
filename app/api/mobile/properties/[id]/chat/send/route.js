import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { sendChat } from "@/lib/services/chat";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await sendChat(userId, id, body.chatId, body.content);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ reply: result.reply }); // `logged` is internal — don't expose
}
