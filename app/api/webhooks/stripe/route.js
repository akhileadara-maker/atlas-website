import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { planByPriceId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Writes/updates the subscriptions row from a Stripe Subscription object.
async function syncSubscription(supabase, sub, fallbackUserId) {
  const userId = sub.metadata?.userId || fallbackUserId;
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id || null;
  const plan = planByPriceId(priceId)?.key || sub.metadata?.plan || null;
  const periodEnd = sub.current_period_end || item?.current_period_end || null;

  const row = {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id || null,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    units: item?.quantity ?? null,
    price_id: priceId,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    await supabase.from("subscriptions").upsert({ user_id: userId, ...row }, { onConflict: "user_id" });
  } else {
    // No user id on the object — match by subscription id instead.
    await supabase.from("subscriptions").update(row).eq("stripe_subscription_id", sub.id);
  }
}

export async function POST(req) {
  const stripe = getStripe();
  const supabase = getSupabase();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !supabase || !secret) {
    return new Response("Billing not configured", { status: 500 });
  }

  // Raw body is required for signature verification.
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(supabase, sub, session.metadata?.userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(supabase, event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e.message);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
