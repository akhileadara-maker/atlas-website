"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addLease, deleteLease, refreshLeaseStatuses } from "@/app/dashboard/[id]/actions";
import { computeLeaseStatus, STATUS_META, formatRent } from "@/lib/leases";

const input =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ leaseEnd }) {
  const meta = STATUS_META[computeLeaseStatus(leaseEnd)];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function DeleteLeaseButton({ id }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await deleteLease(id); })}
      disabled={pending}
      aria-label="Delete lease"
      className="rounded-full px-2 py-1 text-sm font-medium text-navy/40 transition-colors hover:bg-coral/10 hover:text-coral disabled:opacity-50"
    >
      {pending ? "…" : "✕"}
    </button>
  );
}

export default function LeaseIntelligence({ propertyId, leases = [], tableMissing = false }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addLease, {});

  // Auto-update stored lease statuses from today's date whenever this is viewed.
  useEffect(() => {
    if (!tableMissing) refreshLeaseStatuses(propertyId);
  }, [propertyId, tableMissing]);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Lease Intelligence</h2>
          <p className="text-sm text-navy/55">
            Track tenants and lease terms — Atlas flags renewals before they lapse.
          </p>
        </div>
        {!tableMissing && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:bg-teal-600"
          >
            {open ? "Cancel" : "+ Add Lease"}
          </button>
        )}
      </div>

      {tableMissing && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm text-navy/70">
          <p className="font-semibold text-navy">Leases table not found.</p>
          <p className="mt-1">
            Run <code className="rounded bg-navy/5 px-1">supabase/migrations/0006_create_leases.sql</code> in
            the Supabase SQL editor to enable Lease Intelligence.
          </p>
        </div>
      )}

      {/* Add lease form */}
      {open && (
        <form action={formAction} className="mt-6 grid gap-4 rounded-2xl border border-navy/10 bg-cream/60 p-6 sm:grid-cols-2">
          <input type="hidden" name="property_id" value={propertyId} />
          <div>
            <label className={label}>Tenant name</label>
            <input name="tenant_name" required placeholder="Jordan Lee" className={input} />
          </div>
          <div>
            <label className={label}>Tenant email</label>
            <input name="tenant_email" type="email" placeholder="jordan@email.com" className={input} />
          </div>
          <div>
            <label className={label}>Unit number</label>
            <input name="unit_number" placeholder="4B" className={input} />
          </div>
          <div>
            <label className={label}>Monthly rent</label>
            <input name="monthly_rent" type="number" min="0" step="any" placeholder="1800" className={input} />
          </div>
          <div>
            <label className={label}>Lease start</label>
            <input name="lease_start" type="date" className={input} />
          </div>
          <div>
            <label className={label}>Lease end</label>
            <input name="lease_end" type="date" className={input} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save lease"}
            </button>
            {state?.error && <span className="text-sm font-medium text-coral">{state.error}</span>}
          </div>
        </form>
      )}

      {/* Lease table */}
      {!tableMissing && leases.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-cream p-10 text-center">
          <p className="font-medium text-navy">No leases yet.</p>
          <p className="mt-1 text-sm text-navy/55">
            Add a lease to start tracking renewals for this property.
          </p>
        </div>
      )}

      {!tableMissing && leases.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/45">
                <th className="py-3 pr-4 font-semibold">Tenant</th>
                <th className="py-3 pr-4 font-semibold">Unit</th>
                <th className="py-3 pr-4 font-semibold">Rent</th>
                <th className="py-3 pr-4 font-semibold">Term</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
                <th className="py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-navy">{lease.tenant_name}</p>
                    {lease.tenant_email && <p className="text-xs text-navy/50">{lease.tenant_email}</p>}
                  </td>
                  <td className="py-4 pr-4 text-navy/70">{lease.unit_number || "—"}</td>
                  <td className="py-4 pr-4 font-medium text-navy">{formatRent(lease.monthly_rent)}</td>
                  <td className="py-4 pr-4 text-navy/70">
                    {fmtDate(lease.lease_start)} – {fmtDate(lease.lease_end)}
                  </td>
                  <td className="py-4 pr-4">
                    <StatusBadge leaseEnd={lease.lease_end} />
                  </td>
                  <td className="py-4 text-right">
                    <DeleteLeaseButton id={lease.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
