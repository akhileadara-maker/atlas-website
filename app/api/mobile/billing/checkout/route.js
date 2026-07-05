import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { createCheckoutSession } from "@/lib/services/billing";

export const POST = withMobileRoute(async (request) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const body = await request.json().catch(() => ({}));

  // v1: reuse the web success/cancel URLs — the mobile in-app browser shows the
  // web confirmation page (deep-link return is Phase 9 polish, per design doc).
  const host = request.headers.get("host");
  const proto = host && host.includes("localhost") ? "http" : "https";
  const baseUrl = host ? `${proto}://${host}` : "http://localhost:3000";

  let email;
  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
  } catch (e) {
    console.error("checkout email lookup failed:", e.message);
  }

  return serviceResponse(await createCheckoutSession(userId, body.planKey, { baseUrl, email }));
});
