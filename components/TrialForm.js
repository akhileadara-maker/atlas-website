"use client";

import { useActionState } from "react";
import Button from "./Button";
import TrialSignUpButton from "./TrialSignUpButton";
import { CheckIcon } from "./icons";
import { joinWaitlist } from "@/app/demo/actions";

const field =
  "w-full flex-1 rounded-full border border-navy/20 bg-white px-5 py-3.5 text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-teal";

// Guided-demo request (waitlist). Saves name + email to the Supabase
// `waitlist` table. This is NOT account creation — the trial CTAs open Clerk
// sign-up directly (see TrialSignUpButton).
export default function TrialForm() {
  const [state, formAction, pending] = useActionState(joinWaitlist, {});

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-teal/30 bg-teal/10 px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
          <CheckIcon className="h-6 w-6" />
        </span>
        <p className="font-serif text-xl font-bold text-navy">Request received!</p>
        <p className="text-navy/60">
          We&apos;ll be in touch to walk you through Atlas. Can&apos;t wait? Start your free
          trial now — no credit card needed.
        </p>
        <div className="mt-2">
          <TrialSignUpButton variant="teal" size="md">
            Start Free Trial
          </TrialSignUpButton>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input name="name" type="text" placeholder="Your name" aria-label="Your name" className={field} />
        <input
          name="email"
          type="email"
          required
          placeholder="you@yourcompany.com"
          aria-label="Work email"
          className={field}
        />
      </div>
      <div className="mt-3">
        <Button type="submit" variant="teal" size="lg" disabled={pending} className="w-full disabled:opacity-60 sm:w-auto">
          {pending ? "Sending…" : "Request a guided demo"}
        </Button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-coral">{state.error}</p>}
      <p className="mt-3 text-sm text-navy/45">
        Prefer to explore on your own? Use <span className="font-semibold">Start Free Trial</span> —
        no credit card, setup takes an afternoon.
      </p>
    </form>
  );
}
