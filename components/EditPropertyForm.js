"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProperty } from "@/app/dashboard/[id]/actions";

const input =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";

export default function EditPropertyForm({ property }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateProperty, {});

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow text-teal">Property</span>
          <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">{property.name}</h1>
          {property.address && <p className="mt-1 text-navy/60">{property.address}</p>}
          <p className="mt-1 text-navy/60">{property.units} units</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-full border border-navy/20 px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-teal hover:text-teal"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={property.id} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-navy/70">Property name</label>
        <input name="name" defaultValue={property.name} required className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-navy/70">Address</label>
        <input name="address" defaultValue={property.address || ""} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-navy/70">Units</label>
        <input name="units" type="number" min="0" defaultValue={property.units} className={input} />
      </div>
      {state?.error && <p className="text-sm font-medium text-coral sm:col-span-2">{state.error}</p>}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-navy/60 hover:text-navy"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
