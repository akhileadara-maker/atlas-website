// Read-only Tenant AI conversation log. Renders data passed from the server
// detail page (no client interactivity needed).

function fmtDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Conversations({ conversations = [], tableMissing = false }) {
  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <h2 className="text-xl font-bold text-navy">Conversations</h2>
      <p className="text-sm text-navy/55">
        Every tenant message and Atlas&apos;s reply, logged automatically.
      </p>

      {tableMissing && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm text-navy/70">
          <p className="font-semibold text-navy">Conversations table not found.</p>
          <p className="mt-1">
            Run{" "}
            <code className="rounded bg-navy/5 px-1">supabase/migrations/0009_create_conversations.sql</code>{" "}
            in the Supabase SQL editor to enable conversation logging.
          </p>
        </div>
      )}

      {!tableMissing && conversations.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-cream p-10 text-center">
          <p className="font-medium text-navy">No conversations yet.</p>
          <p className="mt-1 text-sm text-navy/55">
            Messages sent through the chat above will appear here.
          </p>
        </div>
      )}

      {!tableMissing && conversations.length > 0 && (
        <ul className="mt-6 divide-y divide-navy/10">
          {conversations.map((c) => (
            <li key={c.id} className="py-5 first:pt-0">
              <p className="text-xs text-navy/40">{fmtDateTime(c.created_at)}</p>
              <div className="mt-2 space-y-2">
                {c.tenant_message && (
                  <div className="flex justify-end">
                    <p className="max-w-[80%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-cream">
                      {c.tenant_message}
                    </p>
                  </div>
                )}
                {c.agent_response && (
                  <div className="flex justify-start">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-navy/10 bg-cream px-4 py-2.5 text-sm text-navy">
                      {c.agent_response}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
