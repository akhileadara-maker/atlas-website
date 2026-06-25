import "server-only";

// Retell REST integration (https://api.retellai.com).
// Server-only: uses the secret RETELL_API_KEY. These exact calls were validated
// end-to-end against the live account before shipping.

const BASE = "https://api.retellai.com";

// The "Atlas - Oakview Apartments" chat agent we clone from. Overridable via env.
const TEMPLATE_AGENT_ID =
  process.env.RETELL_TEMPLATE_AGENT_ID || "agent_b13822df4ffa201a67db49a01c";

// Fields returned by get-conversation-flow that create-conversation-flow rejects.
const READONLY_FLOW_FIELDS = [
  "conversation_flow_id",
  "version",
  "is_published",
  "last_modification_timestamp",
];

const omit = (obj, keys) => {
  const copy = { ...obj };
  keys.forEach((k) => delete copy[k]);
  return copy;
};

const authHeaders = () => {
  const key = process.env.RETELL_API_KEY;
  if (!key) return null;
  return { Authorization: "Bearer " + key };
};

const SIGNAL = () => AbortSignal.timeout(15000);

async function getJSON(path, headers) {
  const r = await fetch(BASE + path, { headers, signal: SIGNAL() });
  if (!r.ok) throw new Error(`Retell GET ${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

async function postJSON(path, headers, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: SIGNAL(),
  });
  if (!r.ok) throw new Error(`Retell POST ${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

async function patchJSON(path, headers, body) {
  const r = await fetch(BASE + path, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: SIGNAL(),
  });
  if (!r.ok) throw new Error(`Retell PATCH ${path} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

export function isRetellConfigured() {
  return Boolean(process.env.RETELL_API_KEY);
}

// Creates a per-property knowledge base + a cloned chat agent.
// Returns { agentId, kbId }. Throws on any failure (caller decides how to handle).
export async function createPropertyAgent({ name, address }) {
  const headers = authHeaders();
  if (!headers) throw new Error("RETELL_API_KEY is not set");

  const agentName = `Atlas - ${name}`.slice(0, 40);

  // 1) Knowledge base — multipart; knowledge_base_texts MUST be a JSON string.
  const form = new FormData();
  form.append("knowledge_base_name", agentName);
  form.append(
    "knowledge_base_texts",
    JSON.stringify([
      {
        title: name,
        text: `Property name: ${name}.\nAddress: ${address || "N/A"}.`,
      },
    ])
  );
  const kbRes = await fetch(BASE + "/create-knowledge-base", {
    method: "POST",
    headers,
    body: form,
    signal: SIGNAL(),
  });
  if (!kbRes.ok)
    throw new Error(`Retell create-knowledge-base -> ${kbRes.status}: ${await kbRes.text()}`);
  const kbId = (await kbRes.json()).knowledge_base_id;

  // 2) Template chat agent -> its conversation flow.
  const tmplAgent = await getJSON(`/get-chat-agent/${TEMPLATE_AGENT_ID}`, headers);
  const tmplFlowId = tmplAgent?.response_engine?.conversation_flow_id;
  if (!tmplFlowId) throw new Error("Template agent has no conversation_flow_id");
  const tmplFlow = await getJSON(`/get-conversation-flow/${tmplFlowId}`, headers);

  // 3) Clone the flow with the new KB attached.
  const flowBody = omit(tmplFlow, READONLY_FLOW_FIELDS);
  flowBody.knowledge_base_ids = [kbId];
  const newFlow = await postJSON("/create-conversation-flow", headers, flowBody);

  // 4) New chat agent pointing at the cloned flow.
  const agent = await postJSON("/create-chat-agent", headers, {
    agent_name: agentName,
    language: tmplAgent.language || "en-US",
    response_engine: {
      type: "conversation-flow",
      conversation_flow_id: newFlow.conversation_flow_id,
    },
  });

  return { agentId: agent.agent_id, kbId };
}

// Replaces a knowledge base's content: adds the new text as a source, then
// removes the sources that existed before (so only the latest content remains).
export async function updateKnowledgeBaseContent(kbId, title, text) {
  const headers = authHeaders();
  if (!headers) throw new Error("RETELL_API_KEY is not set");

  const kb = await getJSON(`/get-knowledge-base/${kbId}`, headers);
  const oldSourceIds = (kb.knowledge_base_sources || [])
    .map((s) => s.source_id)
    .filter(Boolean);

  // Add the new content first so the KB is never momentarily empty.
  const form = new FormData();
  form.append("knowledge_base_texts", JSON.stringify([{ title, text }]));
  const addRes = await fetch(BASE + `/add-knowledge-base-sources/${kbId}`, {
    method: "POST",
    headers,
    body: form,
    signal: SIGNAL(),
  });
  if (!addRes.ok)
    throw new Error(`Retell add-knowledge-base-sources -> ${addRes.status}: ${await addRes.text()}`);

  // Remove the previous sources (best-effort).
  for (const sid of oldSourceIds) {
    await fetch(BASE + `/delete-knowledge-base-source/${kbId}/source/${sid}`, {
      method: "DELETE",
      headers,
      signal: SIGNAL(),
    }).catch(() => {});
  }
}

// Sets the agent's system prompt. For these chat agents the system prompt lives
// in the conversation flow's `global_prompt`, so we resolve the agent's flow id
// and patch it.
export async function updateAgentSystemPrompt(agentId, prompt) {
  const headers = authHeaders();
  if (!headers) throw new Error("RETELL_API_KEY is not set");

  const agent = await getJSON(`/get-chat-agent/${agentId}`, headers);
  const flowId = agent?.response_engine?.conversation_flow_id;
  if (!flowId) throw new Error("Agent has no conversation_flow_id");

  await patchJSON(`/update-conversation-flow/${flowId}`, headers, { global_prompt: prompt });
}

// Deletes an agent and its knowledge base (best-effort) — used when a property
// is removed. Never throws.
export async function deletePropertyAgent({ agentId, kbId }) {
  const headers = authHeaders();
  if (!headers) return;
  if (agentId)
    await fetch(BASE + `/delete-chat-agent/${agentId}`, { method: "DELETE", headers, signal: SIGNAL() }).catch(() => {});
  if (kbId)
    await fetch(BASE + `/delete-knowledge-base/${kbId}`, { method: "DELETE", headers, signal: SIGNAL() }).catch(() => {});
}

// Starts a chat session with an agent. Returns the chat_id.
export async function startChat(agentId) {
  const headers = authHeaders();
  if (!headers) throw new Error("RETELL_API_KEY is not set");
  const res = await postJSON("/create-chat", headers, { agent_id: agentId });
  return res.chat_id;
}

// Sends a message in a chat and returns the agent's text reply.
export async function sendChatMessage(chatId, content) {
  const headers = authHeaders();
  if (!headers) throw new Error("RETELL_API_KEY is not set");
  const res = await postJSON("/create-chat-completion", headers, { chat_id: chatId, content });
  return (res.messages || [])
    .filter((m) => m.role === "agent" && m.content)
    .map((m) => m.content)
    .join("\n\n");
}
