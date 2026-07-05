import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { listLeases, createLease } from "@/lib/services/leases";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await listLeases(userId, id));
}

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await createLease(userId, id, body));
}
