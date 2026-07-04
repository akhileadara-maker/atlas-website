import "server-only";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { getUnitCount } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";

// Creates a Stripe Checkout session for a subscription billed per unit
// (quantity = total units across the landlord's properties). Reuses the
// existing Stripe customer when one is on file. `baseUrl`/`email` are supplied
// by the caller because they come from the web request context.
export async function createCheckoutSession(userId, planKey, { baseUrl, email }) {
  if (!userId) return { error: "You must be signed in." };

  const stripe = getStripe();
  const supabase = getSupabase();
  if (!stripe || !supabase) return { error: "Billing isn't configured (missing Stripe/Supabase env vars)." };

  const plan = PLANS[planKey];
  if (!plan) return { error: "Unknown plan." };

  const units = await getUnitCount(userId);
  const quantity = Math.max(1, units);

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity }],
      success_url: `${baseUrl}/dashboard/billing?success=1`,
      cancel_url: `${baseUrl}/dashboard/billing?canceled=1`,
      metadata: { userId, plan: planKey },
      subscription_data: { metadata: { userId, plan: planKey } },
    });
    return { url: session.url };
  } catch (e) {
    return { error: e.message };
  }
}
