"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { createCheckoutSession as createCheckoutSessionService } from "@/lib/services/billing";

async function baseUrl() {
  const h = await headers();
  const host = h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function createCheckoutSession(planKey) {
  const { userId } = await auth();
  if (!userId) return { error: "You must be signed in." };

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  return createCheckoutSessionService(userId, planKey, { baseUrl: await baseUrl(), email });
}
