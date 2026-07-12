"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  signOutTenant,
  submitTenantRequest,
  tenantChatStart,
  tenantChatSend,
} from "@/app/tenant/actions";
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

// The verified tenant's chat — same UI language as the dashboard test console.
// The hidden priming never appears here: the server returns only the agent's
// greeting reply.
function TenantChat({ propertyId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(null);
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, starting]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const res = await tenantChatStart(propertyId);
      setStarting(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.noLease) {
        setError("We couldn't match your lease — try signing in again.");
        return;
      }
      setChatId(res.chatId);
      setMessages(res.greeting?.trim() ? [{ role: "agent", text: res.greeting }] : []);
    })();
  }, [propertyId]);

  async function onSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !chatId) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    const res = await tenantChatSend(propertyId, chatId, text);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessages((m) => [...m, { role: "agent", text: res.reply }]);
  }

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white">
      <div className="flex items-center gap-2 border-b border-navy/10 bg-white px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-teal" />
        <span className="text-sm font-semibold text-navy">Your property assistant</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-cream px-5 py-4">
        {messages.length === 0 && !starting && !loading && !error && (
          <p className="py-8 text-center text-sm text-navy/45">
            Ask about your lease, rent, or anything about the property.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "rounded-br-md bg-navy text-cream"
                  : "rounded-bl-md border border-navy/10 bg-white text-navy"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {(loading || starting) && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-md border border-navy/10 bg-white px-4 py-2.5 text-sm text-navy/40">
              typing…
            </p>
          </div>
        )}
        {error && <p className="text-center text-sm text-coral">{error}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSend} className="flex gap-2 border-t border-navy/10 bg-white p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy outline-none focus:border-teal"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function RequestForm({ propertyId }) {
  const [formKey, setFormKey] = useState(0);
  return <RequestFormInner key={formKey} propertyId={propertyId} onReset={() => setFormKey((k) => k + 1)} />;
}

function RequestFormInner({ propertyId, onReset }) {
  const [state, formAction, pending] = useActionState(submitTenantRequest, {});

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
        <input type="hidden" name="property_id" value={propertyId} />
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

// The verified tenant home: chat front and center, lease card, request form.
export default function TenantHome({ email, lease, propertyId, multiProperty }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="eyebrow text-teal">Tenant portal</span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-navy">{lease.propertyName}</h1>
          <p className="mt-1 text-sm text-navy/60">
            Signed in as <span className="font-semibold text-navy">{email}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {multiProperty && (
            <Link href="/tenant" className="text-sm font-medium text-teal hover:text-teal-600">
              Change property
            </Link>
          )}
          <form action={signOutTenant}>
            <button className="text-sm font-medium text-teal hover:text-teal-600">Switch email</button>
          </form>
        </div>
      </div>

      <TenantChat propertyId={propertyId} />

      {/* Lease card */}
      <div className="rounded-3xl border border-navy/10 bg-white p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-bold text-navy">Your lease</h2>
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

      <RequestForm propertyId={propertyId} />
    </div>
  );
}
