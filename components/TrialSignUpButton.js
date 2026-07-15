"use client";

import { SignUpButton } from "@clerk/nextjs";
import { variants, sizes } from "./Button";

// A "Start Free Trial" CTA that actually starts the trial: opens the Clerk
// sign-up modal and lands on the dashboard — same behavior as the navbar CTA.
// Styled via Button's exported maps so it's visually identical to Button.
export default function TrialSignUpButton({
  variant = "teal",
  size = "lg",
  className = "",
  children,
}) {
  return (
    <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
      <button
        className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
      >
        {children}
      </button>
    </SignUpButton>
  );
}
