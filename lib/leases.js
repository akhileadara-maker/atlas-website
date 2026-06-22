// Pure lease helpers — safe to import in both server and client components.

export const EXPIRING_SOON_DAYS = 90;

// Derive a lease's status from its end date relative to today.
export function computeLeaseStatus(leaseEnd) {
  if (!leaseEnd) return "active";
  const end = new Date(leaseEnd);
  if (Number.isNaN(end.getTime())) return "active";
  const days = Math.floor((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "active";
}

// Badge styling per status (red = expired, yellow/gold = expiring soon, green/teal = active).
export const STATUS_META = {
  active: { label: "Active", classes: "border-teal/30 bg-teal/12 text-teal-600" },
  expiring_soon: { label: "Expiring soon", classes: "border-gold/50 bg-gold/15 text-gold" },
  expired: { label: "Expired", classes: "border-coral/40 bg-coral/10 text-coral" },
};

export function formatRent(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US");
}
