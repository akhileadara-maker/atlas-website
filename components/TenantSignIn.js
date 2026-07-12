"use client";

import { useActionState } from "react";
import { requestCode, verifyCode } from "@/app/signin/actions";

const field =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";
const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60";

// Two-step tenant sign-in: email -> 6-digit code. The neutral confirmation
// never reveals whether the email is on a lease (anti-enumeration).
export default function TenantSignIn() {
  const [reqState, requestAction, requesting] = useActionState(requestCode, {});
  const [verState, verifyAction, verifying] = useActionState(verifyCode, {});

  // Step 2 — code entry (a code was sent)
  if (reqState?.sent) {
    return (
      <div>
        <p className="text-sm text-navy/60">
          If that email is on a lease, a code is on its way. Enter it below —
          it expires in 10 minutes.
        </p>
        <form action={verifyAction} className="mt-4 space-y-4">
          <input type="hidden" name="email" value={reqState.email} readOnly />
          <div>
            <label className={label}>6-digit code</label>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="123456"
              onChange={(e) => {
                // Keep the value digits-only (the wide letter-spacing is
                // display-only) so pasted codes like "123 456" validate.
                e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
              }}
              className={`${field} text-center text-2xl tracking-[0.5em]`}
            />
          </div>
          {verState?.error && <p className="text-sm text-coral">{verState.error}</p>}
          <button type="submit" disabled={verifying} className={`${tealBtn} w-full`}>
            {verifying ? "Verifying…" : "Sign in"}
          </button>
        </form>
        <form action={requestAction} className="mt-3 text-center">
          <input type="hidden" name="email" value={reqState.email} readOnly />
          <button type="submit" disabled={requesting} className="text-sm font-medium text-teal hover:text-teal-600">
            {requesting ? "Sending…" : "Resend code"}
          </button>
        </form>
      </div>
    );
  }

  // Step 1 — email entry
  return (
    <form action={requestAction} className="space-y-4">
      <div>
        <label className={label}>Your email</label>
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          className={field}
        />
        <p className="mt-1 text-xs text-navy/45">Use the email your landlord has on file for your lease.</p>
      </div>
      {reqState?.error && <p className="text-sm text-coral">{reqState.error}</p>}
      <button type="submit" disabled={requesting} className={`${tealBtn} w-full`}>
        {requesting ? "Sending code…" : "Email me a code"}
      </button>
    </form>
  );
}
