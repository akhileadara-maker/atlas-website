// Pure maintenance/dispatch helpers — safe to import in server and client code.

export const URGENCY_OPTIONS = ["urgent", "normal", "low"];
export const STATUS_OPTIONS = ["open", "in_progress", "resolved"];

// Urgency badges: urgent = red/coral, normal = yellow/gold, low = muted navy.
export const URGENCY_META = {
  urgent: { label: "Urgent", classes: "border-coral/40 bg-coral/10 text-coral" },
  normal: { label: "Normal", classes: "border-gold/50 bg-gold/15 text-gold" },
  low: { label: "Low", classes: "border-navy/15 bg-navy/5 text-navy/55" },
};

// Status badges: open = neutral, in progress = gold, resolved = green/teal.
export const STATUS_META = {
  open: { label: "Open", classes: "border-navy/20 bg-navy/5 text-navy/70" },
  in_progress: { label: "In progress", classes: "border-gold/50 bg-gold/15 text-gold" },
  resolved: { label: "Resolved", classes: "border-teal/30 bg-teal/12 text-teal-600" },
};
