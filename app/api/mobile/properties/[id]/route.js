import { requireUserId, serviceResponse, withMobileRoute } from "@/lib/mobile-api";
import {
  getProperty,
  updatePropertyDetails,
  deletePropertyById,
} from "@/lib/services/properties";

export const dynamic = "force-dynamic";

export const GET = withMobileRoute(async (_request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await getProperty(userId, id));
});

export const PATCH = withMobileRoute(async (request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!("name" in body) || !("address" in body) || !("units" in body)) {
    return serviceResponse({ error: "name, address, and units are all required." });
  }
  return serviceResponse(
    await updatePropertyDetails(userId, id, { name: body.name, address: body.address, units: body.units })
  );
});

export const DELETE = withMobileRoute(async (_request, { params }) => {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await deletePropertyById(userId, id));
});
