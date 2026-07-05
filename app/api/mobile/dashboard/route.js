import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import { getDashboardData } from "@/lib/services/properties";
import { saveNotificationEmail } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export const GET = withMobileRoute(async () => {
  const { userId, response } = await requireUserId();
  if (response) return response;

  // Same best-effort side effect as the web dashboard: keep the landlord's
  // notification email fresh so maintenance/lease alerts have a recipient.
  try {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (email) await saveNotificationEmail(userId, email);
  } catch (e) {
    console.error("saveNotificationEmail failed:", e.message);
  }

  return serviceResponse(await getDashboardData(userId));
});
