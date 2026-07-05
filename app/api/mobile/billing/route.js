import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/mobile-api";
import { getSubscription, getUnitCount, isActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const [units, sub] = await Promise.all([getUnitCount(userId), getSubscription(userId)]);
  return NextResponse.json({
    plan: sub?.plan || null,
    status: sub?.status || null,
    active: isActive(sub),
    units,
    billedUnits: Math.max(1, units),
  });
}
