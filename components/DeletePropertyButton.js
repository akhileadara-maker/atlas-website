"use client";

import { useState, useTransition } from "react";
import { deleteProperty } from "@/app/dashboard/[id]/actions";

export default function DeletePropertyButton({ id }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to /dashboard; only errors return here.
      const res = await deleteProperty(id);
      if (res?.error) setError(res.error);
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full border border-coral/40 px-5 py-2.5 text-sm font-semibold text-coral transition-colors hover:bg-coral/10"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-navy/60">Delete this property and its agent?</span>
      <button
        onClick={onDelete}
        disabled={pending}
        className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-105 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-full px-3 py-2 text-sm font-medium text-navy/60 hover:text-navy"
      >
        Cancel
      </button>
      {error && <span className="text-sm text-coral">{error}</span>}
    </div>
  );
}
