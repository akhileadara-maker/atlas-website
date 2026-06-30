"use client";

import { useEffect, useRef, useState } from "react";
import { startChatSession, sendChat, triggerWelcome } from "@/app/dashboard/[id]/actions";

export default function ChatWidget({ propertyId, hasAgent }) {
  const [messages, setMessages] = useState([]); // { role: "user" | "agent", text }
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const welcomedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // On load, open the chat session and fire an empty trigger message so the
  // agent's Welcome Node greeting appears before the tenant types anything.
  useEffect(() => {
    if (!hasAgent || welcomedRef.current) return;
    welcomedRef.current = true;
    (async () => {
      setLoading(true);
      const res = await startChatSession(propertyId);
      if (res.error) {
        setLoading(false);
        return; // No greeting, but the chat still works once the tenant types.
      }
      setChatId(res.chatId);
      const welcome = await triggerWelcome(res.chatId);
      setLoading(false);
      if (welcome?.reply?.trim()) {
        setMessages((m) => [...m, { role: "agent", text: welcome.reply }]);
      }
    })();
  }, [hasAgent, propertyId]);

  if (!hasAgent) {
    return (
      <div className="rounded-2xl border border-dashed border-navy/15 bg-cream p-8 text-center text-sm text-navy/55">
        This property doesn&apos;t have an AI agent yet. It&apos;s created automatically when you add a
        property — give it a moment, then refresh.
      </div>
    );
  }

  async function ensureChat() {
    if (chatId) return chatId;
    const res = await startChatSession(propertyId);
    if (res.error) {
      setError(res.error);
      return null;
    }
    setChatId(res.chatId);
    return res.chatId;
  }

  async function onSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);

    const cid = await ensureChat();
    if (!cid) {
      setLoading(false);
      return;
    }
    const res = await sendChat(propertyId, cid, text);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessages((m) => [...m, { role: "agent", text: res.reply }]);
  }

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-cream">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-navy/10 bg-white px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-teal" />
        <span className="text-sm font-semibold text-navy">Atlas Assistant</span>
        <span className="ml-auto text-xs text-navy/40">live test</span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-navy/45">
            Ask your agent something a tenant might — e.g. &ldquo;What&apos;s the late fee?&rdquo; or
            &ldquo;Are pets allowed?&rdquo;
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
        {loading && (
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
  );
}
