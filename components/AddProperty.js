"use client";

import { useActionState, useEffect, useState } from "react";
import { addProperty } from "@/app/dashboard/actions";

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-teal";

export default function AddProperty() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addProperty, {});

  // Close + reset the form once a property saves successfully.
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:bg-teal-600"
      >
        {open ? "Cancel" : "+ Add Property"}
      </button>

      {open && (
        <form
          action={formAction}
          className="mt-5 grid gap-4 rounded-2xl border border-navy/10 bg-white p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-navy/70">Property name</label>
            <input name="name" required placeholder="Maple Court Apartments" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-navy/70">Address</label>
            <input name="address" placeholder="123 Main St, Dallas, TX" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy/70">Units</label>
            <input name="units" type="number" min="0" defaultValue={1} className={inputClass} />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save property"}
            </button>
          </div>

          {state?.error && (
            <p className="sm:col-span-2 text-sm font-medium text-coral">{state.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
