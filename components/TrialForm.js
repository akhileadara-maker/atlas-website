"use client";

import { useState } from "react";
import Button from "./Button";
import { CheckIcon } from "./icons";

// Front-end-only trial signup. Validates the email and shows a success state.
// (Wire this up to a real API route or form service when you're ready.)
export default function TrialForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | error | success
  const isValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function onSubmit(e) {
    e.preventDefault();
    if (!isValid(email.trim())) {
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-teal/30 bg-teal/10 px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
          <CheckIcon className="h-6 w-6" />
        </span>
        <p className="font-serif text-xl font-bold text-navy">You&apos;re on the list!</p>
        <p className="text-navy/60">
          Check your inbox — we&apos;ll be in touch to set up your free 30-day trial.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@yourcompany.com"
          aria-label="Work email"
          className={`flex-1 rounded-full border bg-white px-5 py-3.5 text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-teal ${
            status === "error" ? "border-coral" : "border-navy/20"
          }`}
        />
        <Button type="submit" variant="teal" size="lg" className="shrink-0">
          Start Free Trial
        </Button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-sm text-coral">Please enter a valid email address.</p>
      )}
      <p className="mt-3 text-sm text-navy/45">
        No credit card required · Setup takes an afternoon · Cancel anytime.
      </p>
    </form>
  );
}
