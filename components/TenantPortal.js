"use client";

import { useActionState, useState, useTransition } from "react";
import { lookupTenant, submitTenantRequest } from "@/app/tenant/actions";
import { STATUS_META as LEASE_STATUS_META } from "@/lib/leases";
import { CheckIcon } from "./icons";

const field =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";
const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }) {
  const meta = LEASE_STATUS_META[status] || LEASE_STATUS_META.active;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function LeaseCard({ lease }) {
  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl font-bold text-navy">{lease.propertyName}</h2>
          {lease.propertyAddress && <p className="mt-1 text-navy/60">{lease.propertyAddress}</p>}
          {lease.unitNumber && <p className="text-sm text-navy/55">Unit {lease.unitNumber}</p>}
        </div>
        <StatusBadge status={lease.status} />
      </div>
      <div className="mt-5 grid gap-4 border-t border-navy/10 pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-navy/45">Lease ends</p>
          <p className="mt-1 font-serif text-xl font-bold text-navy">{fmtDate(lease.leaseEnd)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-navy/45">Lease started</p>
          <p className="mt-1 font-serif text-xl font-bold text-navy">{fmtDate(lease.leaseStart)}</p>
        </div>
      </div>
    </div>
  );
}

function RequestForm({ email, leases }) {
  const [formKey, setFormKey] = useState(0);
  return <RequestFormInner key={formKey} email={email} leases={leases} onReset={() => setFormKey((k) => k + 1)} />;
}

function RequestFormInner({ email, leases, onReset }) {
  const [state, formAction, pending] = useActionState(submitTenantRequest, {});

  // Distinct properties the tenant has a lease at.
  const properties = [];
  const seen = new Set();
  for (const l of leases) {
    if (!seen.has(l.propertyId)) {
      seen.add(l.propertyId);
      properties.push({ id: l.propertyId, name: l.propertyName });
    }
  }

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-teal/30 bg-teal/10 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
          <CheckIcon className="h-6 w-6" />
        </span>
        <p className="font-serif text-xl font-bold text-navy">Request submitted!</p>
        <p className="text-navy/60">Your property manager has been notified and will follow up.</p>
        <button onClick={onReset} className="mt-2 text-sm font-semibold text-teal hover:text-teal-600">
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <h2 className="text-xl font-bold text-navy">Submit a maintenance request</h2>
      <p className="text-sm text-navy/55">We&apos;ll send it straight to your property manager.</p>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="email" value={email} />

        {properties.length > 1 ? (
          <div>
            <label className={label}>Property</label>
            <select name="property_id" className={field} defaultValue={properties[0].id}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="property_id" value={properties[0].id} />
        )}

        <div>
          <label className={label}>Issue</label>
          <input name="title" required placeholder="e.g. Leaking faucet in the kitchen" className={field} />
        </div>
        <div>
          <label className={label}>Details</label>
          <textarea name="description" rows={3} placeholder="When did it start, where exactly, access notes…" className={field} />
        </div>
        <div>
          <label className={label}>Urgency</label>
          <select name="urgency" defaultValue="normal" className={field}>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={tealBtn}>
            {pending ? "Submitting…" : "Submit request"}
          </button>
          {state?.error && <span className="text-sm font-medium text-coral">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}

export default function TenantPortal() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null); // { email, leases }
  const [error, setError] = useState(null);
  const [looking, startLookup] = useTransition();

  function onLookup(e) {
    e.preventDefault();
    setError(null);
    startLookup(async () => {
      const res = await lookupTenant(email);
      if (res.error) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult({ email: res.email, leases: res.leases });
    });
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  // Step 1 — email lookup
  if (!result) {
    return (
      <div className="rounded-3xl border border-navy/10 bg-white p-7">
        <form onSubmit={onLookup}>
          <label className={label}>Your email</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={field}
            />
            <button type="submit" disabled={looking} className={`${tealBtn} w-full sm:w-auto sm:shrink-0`}>
              {looking ? "Looking up…" : "Look up my lease"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-coral">{error}</p>}
          <p className="mt-3 text-xs text-navy/45">Use the email your landlord has on file for your lease.</p>
        </form>
      </div>
    );
  }

  // Step 2b — no lease found
  if (result.leases.length === 0) {
    return (
      <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
        <p className="font-semibold text-navy">No lease found for {result.email}.</p>
        <p className="mt-1 text-sm text-navy/55">
          Double-check the email your landlord has on file, or contact them directly.
        </p>
        <button onClick={reset} className="mt-4 text-sm font-semibold text-teal hover:text-teal-600">
          Try another email
        </button>
      </div>
    );
  }

  // Step 2 — leases found
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-navy/60">
          Signed in as <span className="font-semibold text-navy">{result.email}</span>
        </p>
        <button onClick={reset} className="text-sm font-medium text-teal hover:text-teal-600">
          Switch email
        </button>
      </div>

      <div className="space-y-4">
        {result.leases.map((lease) => (
          <LeaseCard key={lease.id} lease={lease} />
        ))}
      </div>

      <RequestForm email={result.email} leases={result.leases} />
    </div>
  );
}
