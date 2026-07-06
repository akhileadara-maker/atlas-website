import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { registerPushToken } from "@/lib/services/pushTokens";

export const POST = withMobileRoute(async (request) => {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  return serviceResponse(
    await registerPushToken(userId, {
      expoPushToken: body.expoPushToken,
      platform: body.platform,
    })
  );
});
