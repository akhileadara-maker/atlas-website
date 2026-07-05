import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { listRequests, createRequest } from "@/lib/services/maintenance";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await listRequests(userId, id));
}

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Same best-effort email side effect as the web action.
  let landlordEmail = null;
  try {
    const user = await currentUser();
    landlordEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  return serviceResponse(
    await createRequest(
      userId,
      id,
      { title: body.title, description: body.description, urgency: body.urgency },
      { landlordEmail }
    )
  );
}
