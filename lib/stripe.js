import "server-only";
import Stripe from "stripe";

// SERVER-ONLY Stripe client using the secret key. Lazily created so a missing
// env var during build never throws. Returns null when not configured.
let client = null;

export function getStripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key);
  return client;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
