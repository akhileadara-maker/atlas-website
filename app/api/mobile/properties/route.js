import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { createProperty } from "@/lib/services/properties";

export async function POST(request) {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  return serviceResponse(
    await createProperty(userId, { name: body.name, address: body.address, units: body.units })
  );
}
