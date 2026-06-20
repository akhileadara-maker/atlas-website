// Atlas billing plans. Price IDs are from the Stripe test-mode products created
// for this account. Not secret — safe to keep in source.
export const PLANS = {
  dispatch: {
    key: "dispatch",
    name: "Dispatch",
    priceId: "price_1TkVXj1b1pFGe4B6HzKEJGjG",
    unitPrice: 6,
    tagline: "Automated maintenance dispatch.",
  },
  lease: {
    key: "lease",
    name: "Lease Intelligence",
    priceId: "price_1TkVXk1b1pFGe4B6AJQxiIqp",
    unitPrice: 10,
    tagline: "Lease tracking + 90-day renewal flags.",
  },
  full: {
    key: "full",
    name: "Full Platform",
    priceId: "price_1TkVXk1b1pFGe4B6Pl8jie1T",
    unitPrice: 15,
    tagline: "Tenant AI + everything Atlas does.",
  },
};

export const PLAN_ORDER = ["dispatch", "lease", "full"];

export function planByPriceId(priceId) {
  return Object.values(PLANS).find((p) => p.priceId === priceId) || null;
}
