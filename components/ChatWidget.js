"use client";

import { useEffect, useRef, useState } from "react";
import { startTenantChat, sendChat } from "@/app/dashboard/[id]/actions";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function Header({ email, onSwitch }) {
  return (
    <div className="flex items-center gap-2 border-b border-navy/10 bg-white px-5 py-3">
      <span className="h-2 w-2 rounded-full bg-teal" />
      <span className="text-sm font-semibold text-navy">Atlas Assistant</span>
      {email ? (
        <button
          onClick={onSwitch}
          title={email}
          className="ml-auto text-xs font-medium text-teal transition-colors hover:text-teal-600"
        >
          Switch email
        </button>
      ) : (
        <span className="ml-auto text-xs text-navy/40">live test</span>
      )}
    </div>
  );
}

export default function ChatWidget({ propertyId, hasAgent }) {
  const [email, setEmail] = useState(null); // verified tenant email (has a lease)
  const [emailInput, setEmailInput] = useState("");
  const [messages, setMessages] = useState([]); // { role: "user" | "agent", text }
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false); // sending a message
  const [starting, setStarting] = useState(false); // looking up lease + opening chat
  const [error, setError] = useState(null);
  const [noLease, setNoLease] = useState(false);
  const [tested, setTested] = useState(false); // a real exchange happened → show the share card
  const [copied, setCopied] = useState(false);
  const endRef = useRef(null);
  const autoStartedRef = useRef(false);
  const storageKey = `atlas_tenant_email_${propertyId}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, starting]);

  // Remember the tenant's email across reloads so they don't re-enter it.
  useEffect(() => {
    if (!hasAgent || autoStartedRef.current) return;
    autoStartedRef.current = true;
    let saved = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    if (saved) begin(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAgent]);

  if (!hasAgent) {
    return (
      <div className="rounded-2xl border border-dashed border-navy/15 bg-cream p-8 text-center text-sm text-navy/55">
        This property doesn&apos;t have an AI agent yet. It&apos;s created automatically when you add a
        property — give it a moment, then refresh.
      </div>
    );
  }

  // Verify the email against a lease and open a lease-aware chat.
  async function begin(addr) {
    const e = (addr || "").trim().toLowerCase();
    if (!isEmail(e)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setNoLease(false);
    setStarting(true);
    const res = await startTenantChat(propertyId, e);
    setStarting(false);

    if (res.noLease) {
      setNoLease(true);
      return;
    }
    if (res.error) {
      setError(res.error);
      return;
    }

    setEmail(e);
    try {
      sessionStorage.setItem(storageKey, e);
    } catch {
      /* sessionStorage unavailable — fine, they'll just re-enter next time */
    }
    setChatId(res.chatId);
    setMessages(res.greeting?.trim() ? [{ role: "agent", text: res.greeting }] : []);
  }

  function onEmailSubmit(e) {
    e.preventDefault();
    begin(emailInput);
  }

  function switchEmail() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setEmail(null);
    setEmailInput("");
    setChatId(null);
    setMessages([]);
    setNoLease(false);
    setError(null);
  }

  async function onSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !chatId) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);

    const res = await sendChat(propertyId, chatId, text);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessages((m) => [...m, { role: "agent", text: res.reply }]);
    setTested(true);
  }

  async function copySignInLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/signin`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the visible URL can be copied by hand */
    }
  }

  // ---- Email gate: ask who they are before chatting ----
  if (!email) {
    return (
      <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-cream">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          {starting ? (
            <p className="text-sm text-navy/50">Looking up the lease…</p>
          ) : noLease ? (
            <>
              <p className="font-semibold text-navy">No lease matches that email yet.</p>
              <p className="mt-1 text-sm text-navy/55">
                The agent answers as a specific tenant, so it needs a lease to work from. Add a
                lease with a tenant email in{" "}
                <a href="#leases" className="font-semibold text-teal hover:text-teal-600">
                  Leases
                </a>{" "}
                below, then test with that email.
              </p>
              <button
                onClick={switchEmail}
                className="mt-4 text-sm font-semibold text-teal transition-colors hover:text-teal-600"
              >
                Try another email
              </button>
            </>
          ) : (
            <form onSubmit={onEmailSubmit} className="w-full max-w-sm">
              <p className="font-semibold text-navy">Test the chat your tenants will see</p>
              <p className="mt-1 text-sm text-navy/55">
                Enter a tenant email from one of this property&apos;s leases — the agent will answer
                with that tenant&apos;s lease details.
              </p>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@email.com"
                className="mt-4 w-full rounded-full border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={starting}
                className="mt-3 w-full rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
              >
                Start chat
              </button>
              {error && <p className="mt-2 text-sm text-coral">{error}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  // ---- Chat ----
  return (
    <div className="space-y-4">
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-cream">
      <Header email={email} onSwitch={switchEmail} />

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !starting && !loading && (
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
                  : "rounded-bl-md bg-white text-navy border border-navy/10"
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

      {/* Input */}
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

    {/* Share card — appears once the landlord has had a real exchange */}
    {tested && (
      <div className="rounded-2xl border border-teal/25 bg-teal/5 p-5">
        <p className="font-serif text-lg font-bold text-navy">Working? Share it with your tenants.</p>
        <p className="mt-1 text-sm text-navy/60">
          Tenants sign in with the email on their lease — they get this same chat, plus their
          lease details and a maintenance request form.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-white px-3 py-1.5 text-sm text-navy">
            {typeof window !== "undefined" ? `${window.location.origin}/signin` : "/signin"}
          </code>
          <button
            onClick={copySignInLink}
            className="rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
