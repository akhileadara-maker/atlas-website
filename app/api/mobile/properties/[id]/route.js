import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import {
  getProperty,
  updatePropertyDetails,
  deletePropertyById,
} from "@/lib/services/properties";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await getProperty(userId, id));
}

export async function PATCH(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(
    await updatePropertyDetails(userId, id, { name: body.name, address: body.address, units: body.units })
  );
}

export async function DELETE(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await deletePropertyById(userId, id));
}
