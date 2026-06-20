"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { getUnitCount } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";

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

  const stripe = getStripe();
  const supabase = getSupabase();
  if (!stripe || !supabase) return { error: "Billing isn't configured (missing Stripe/Supabase env vars)." };

  const plan = PLANS[planKey];
  if (!plan) return { error: "Unknown plan." };

  // Billed per unit: quantity = total units across the landlord's properties.
  const units = await getUnitCount(userId);
  const quantity = Math.max(1, units);

  // Reuse the Stripe customer if we already have one for this user.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const customer = await stripe.customers.create({
      email,
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;
  }

  const url = await baseUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity }],
      success_url: `${url}/dashboard/billing?success=1`,
      cancel_url: `${url}/dashboard/billing?canceled=1`,
      metadata: { userId, plan: planKey },
      subscription_data: { metadata: { userId, plan: planKey } },
    });
    return { url: session.url };
  } catch (e) {
    return { error: e.message };
  }
}
