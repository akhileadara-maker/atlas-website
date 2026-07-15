// Backfill the CURRENT system prompt to every property's Retell agent.
//
//   node scripts/sync-agent-prompts.mjs            # sync agents on the old prompt
//   node scripts/sync-agent-prompts.mjs --force    # re-push to every agent
//
// Run this after any edit to lib/agentPrompt.mjs: a KB save only re-injects the
// prompt for that one property, so without a backfill, agents silently keep the
// old prompt (found the hard way on 2026-07-14 — 5 of 6 agents were stale).
// The prompt composed here is the exact same module the KB save uses, including
// each property's preferred language. Reads env from .env.local (or the
// environment). Prints per-agent results; exits non-zero if any push fails.
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { composeSystemPrompt } from "../lib/agentPrompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].trim();
  }
} catch {
  // no .env.local — rely on the environment
}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RETELL_API_KEY"];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const force = process.argv.includes("--force");

const sbHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
};
const RETELL = "https://api.retellai.com";
const rHeaders = { Authorization: "Bearer " + env.RETELL_API_KEY };

async function getJSON(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}: ${await r.text()}`);
  return r.json();
}

const props = await getJSON(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/properties?select=id,name,retell_agent_id,kb_data&retell_agent_id=not.is.null`,
  sbHeaders
);
console.log(`${props.length} propert${props.length === 1 ? "y" : "ies"} with agents\n`);

let failures = 0;
for (const p of props) {
  try {
    const agent = await getJSON(`${RETELL}/get-chat-agent/${p.retell_agent_id}`, rHeaders);
    const flowId = agent?.response_engine?.conversation_flow_id;
    if (!flowId) throw new Error("agent has no conversation_flow_id");

    const prompt = composeSystemPrompt(p.name, p.kb_data?.preferred_language);
    const flow = await getJSON(`${RETELL}/get-conversation-flow/${flowId}`, rHeaders);
    if (!force && flow?.global_prompt === prompt) {
      console.log(`in sync:  ${p.name}`);
      continue;
    }

    const res = await fetch(`${RETELL}/update-conversation-flow/${flowId}`, {
      method: "PATCH",
      headers: { ...rHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ global_prompt: prompt }),
    });
    if (!res.ok) throw new Error(`PATCH flow -> ${res.status}: ${await res.text()}`);
    console.log(`updated:  ${p.name}`);
  } catch (e) {
    failures++;
    console.error(`FAILED:   ${p.name} — ${e.message}`);
  }
}

if (failures) {
  console.error(`\n${failures} agent(s) failed — re-run after fixing.`);
  process.exit(1);
}
console.log("\nAll agents in sync.");
