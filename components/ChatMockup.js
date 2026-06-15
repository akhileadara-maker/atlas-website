import { CheckIcon, WrenchIcon } from "./icons";

// A faux product UI: a tenant maintenance request and Atlas's automated reply,
// ending with an action (vendor dispatched). Pure presentation — no state.
export default function ChatMockup({ className = "" }) {
  return (
    <div
      className={`w-full max-w-sm rounded-3xl border border-navy/10 bg-white p-5 shadow-2xl shadow-navy/20 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-navy/10 pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/15 text-teal">
          <WrenchIcon className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="font-serif text-base font-bold text-navy">Atlas Assistant</p>
          <p className="flex items-center gap-1.5 text-xs text-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Online · replies instantly
          </p>
        </div>
        <span className="ml-auto text-xs font-medium text-navy/40">11:47 PM</span>
      </div>

      {/* Conversation */}
      <div className="space-y-3 py-4">
        {/* Tenant message */}
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-cream">
            Hi — the faucet in apartment 4B won&apos;t stop running. It&apos;s getting worse.
          </p>
        </div>

        {/* Atlas reply */}
        <div className="flex justify-start">
          <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-bodygray px-4 py-2.5 text-sm text-navy">
            Thanks for flagging that, Jordan. A running faucet can cause water damage, so I&apos;m treating
            this as <span className="font-semibold text-coral">urgent</span>. Dispatching an on-call
            plumber now.
          </p>
        </div>

        {/* Action chip */}
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm font-medium text-teal-600">
            <CheckIcon className="h-4 w-4" />
            Plumber dispatched · ETA 35 min
          </div>
        </div>
      </div>

      {/* Footer summary */}
      <div className="rounded-2xl bg-cream px-4 py-3 text-xs text-navy/60">
        <span className="font-semibold text-navy">Logged automatically:</span> maintenance ticket #4192,
        vendor notified, tenant updated. No action needed from you.
      </div>
    </div>
  );
}
