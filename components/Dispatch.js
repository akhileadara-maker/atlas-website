"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addMaintenanceRequest,
  deleteMaintenanceRequest,
  updateMaintenanceStatus,
} from "@/app/dashboard/[id]/actions";
import { URGENCY_META, STATUS_META, STATUS_OPTIONS } from "@/lib/maintenance";

const input =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function UrgencyBadge({ urgency }) {
  const meta = URGENCY_META[urgency] || URGENCY_META.normal;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function StatusSelect({ id, status }) {
  const [pending, start] = useTransition();
  const meta = STATUS_META[status] || STATUS_META.open;
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(async () => {
          await updateMaintenanceStatus(id, next);
        });
      }}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold outline-none ${meta.classes} ${pending ? "opacity-60" : ""}`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </select>
  );
}

function DeleteRequestButton({ id }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await deleteMaintenanceRequest(id); })}
      disabled={pending}
      aria-label="Delete request"
      className="rounded-full px-2 py-1 text-sm font-medium text-navy/40 transition-colors hover:bg-coral/10 hover:text-coral disabled:opacity-50"
    >
      {pending ? "…" : "✕"}
    </button>
  );
}

export default function Dispatch({ propertyId, requests = [], tableMissing = false }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addMaintenanceRequest, {});

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Dispatch</h2>
          <p className="text-sm text-navy/55">
            Log maintenance requests, triage by urgency, and track them to resolved.
          </p>
        </div>
        {!tableMissing && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:bg-teal-600"
          >
            {open ? "Cancel" : "+ New Request"}
          </button>
        )}
      </div>

      {tableMissing && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm text-navy/70">
          <p className="font-semibold text-navy">Maintenance table not found.</p>
          <p className="mt-1">
            Run{" "}
            <code className="rounded bg-navy/5 px-1">supabase/migrations/0007_create_maintenance_requests.sql</code>{" "}
            in the Supabase SQL editor to enable Dispatch.
          </p>
        </div>
      )}

      {/* New request form */}
      {open && (
        <form action={formAction} className="mt-6 grid gap-4 rounded-2xl border border-navy/10 bg-cream/60 p-6">
          <input type="hidden" name="property_id" value={propertyId} />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className={label}>Title</label>
              <input name="title" required placeholder="Leaking faucet in unit 4B" className={input} />
            </div>
            <div>
              <label className={label}>Urgency</label>
              <select name="urgency" defaultValue="normal" className={input}>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea name="description" rows={3} placeholder="Details, access instructions, vendor notes…" className={input} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Log request"}
            </button>
            {state?.error && <span className="text-sm font-medium text-coral">{state.error}</span>}
          </div>
        </form>
      )}

      {/* Empty state */}
      {!tableMissing && requests.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-cream p-10 text-center">
          <p className="font-medium text-navy">No requests yet.</p>
          <p className="mt-1 text-sm text-navy/55">Log a maintenance request to start the dispatch queue.</p>
        </div>
      )}

      {/* Request log */}
      {!tableMissing && requests.length > 0 && (
        <ul className="mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl border border-navy/10 bg-cream/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy">{r.title}</p>
                    <UrgencyBadge urgency={r.urgency} />
                  </div>
                  {r.description && <p className="mt-1 text-sm text-navy/60">{r.description}</p>}
                </div>
                <DeleteRequestButton id={r.id} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusSelect id={r.id} status={r.status} />
                <span className="text-xs text-navy/40">{fmtDate(r.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
