"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/app/dashboard/billing/actions";

export default function SubscribeButton({ planKey, label = "Subscribe", disabled = false, className = "" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await createCheckoutSession(planKey);
      if (res?.error) setError(res.error);
      else if (res?.url) window.location.href = res.url; // redirect to Stripe Checkout
    });
  }

  return (
    <>
      <button onClick={go} disabled={disabled || pending} className={className}>
        {pending ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-coral">{error}</p>}
    </>
  );
}
