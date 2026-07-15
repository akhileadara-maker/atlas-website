// Atlas billing plans — VOLUME tiers (2026-07-14): every plan includes the full
// product (Tenant AI, Lease Intelligence, Dispatch); the tier is determined by
// the landlord's unit count, not chosen. Price IDs are from the Stripe
// test-mode products created for this account. Not secret — safe in source.
export const PLANS = {
  starter: {
    key: "starter",
    name: "Starter",
    priceId: "price_1TtIVW1b1pFGe4B6BWJTcswZ",
    unitPrice: 15,
    minUnits: 1,
    maxUnits: 49,
    range: "1–49 units",
    tagline: "The full platform for growing portfolios.",
  },
  growth: {
    key: "growth",
    name: "Growth",
    priceId: "price_1TtIVX1b1pFGe4B6LzEbSeLW",
    unitPrice: 10,
    minUnits: 50,
    maxUnits: 300,
    range: "50–300 units",
    tagline: "Volume pricing as you scale.",
  },
  portfolio: {
    key: "portfolio",
    name: "Portfolio",
    priceId: "price_1TtIVX1b1pFGe4B6jzhjCFa0",
    unitPrice: 6,
    minUnits: 301,
    maxUnits: null,
    range: "300+ units",
    tagline: "Our best rate for large portfolios.",
  },
};

export const PLAN_ORDER = ["starter", "growth", "portfolio"];

// The tier a landlord lands in, from their billed unit count (min 1).
export function planForUnits(units) {
  const u = Math.max(1, units || 0);
  if (u <= 49) return PLANS.starter;
  if (u <= 300) return PLANS.growth;
  return PLANS.portfolio;
}

// Pre-2026-07-14 feature tiers. Kept ONLY so existing subscriptions keep
// displaying and their Stripe renewals keep syncing via planByPriceId.
// Not offered for new checkout (absent from PLAN_ORDER).
const LEGACY_PLANS = {
  dispatch: {
    key: "dispatch",
    name: "Dispatch (legacy)",
    priceId: "price_1TkVXj1b1pFGe4B6HzKEJGjG",
    unitPrice: 6,
    tagline: "Automated maintenance dispatch.",
  },
  lease: {
    key: "lease",
    name: "Lease Intelligence (legacy)",
    priceId: "price_1TkVXk1b1pFGe4B6AJQxiIqp",
    unitPrice: 10,
    tagline: "Lease tracking + 90-day renewal flags.",
  },
  full: {
    key: "full",
    name: "Full Platform (legacy)",
    priceId: "price_1TkVXk1b1pFGe4B6Pl8jie1T",
    unitPrice: 15,
    tagline: "Tenant AI + everything Atlas does.",
  },
};

// Resolve a stored plan key (current or legacy) for display.
export function planByKey(key) {
  return PLANS[key] || LEGACY_PLANS[key] || null;
}

export function planByPriceId(priceId) {
  return (
    Object.values(PLANS).find((p) => p.priceId === priceId) ||
    Object.values(LEGACY_PLANS).find((p) => p.priceId === priceId) ||
    null
  );
}
