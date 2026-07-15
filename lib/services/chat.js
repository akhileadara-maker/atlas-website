import "server-only";
import { getSupabase } from "@/lib/supabase";
import { startChat, sendChatMessage } from "@/lib/retell";
import { computeLeaseStatus, formatRent, STATUS_META } from "@/lib/leases";

const str = (v) => (v == null ? "" : v.toString().trim());

// L4: cap what we relay to Retell / insert into conversations.
const MAX_MESSAGE_LENGTH = 2000;

// M2: every chat is bound to its owner at start and checked on every send, so
// a chatId can't be replayed into someone else's conversation. user_id is the
// landlord who owns the property; tenant_email is set for tenant chats.
async function recordChatSession(supabase, { chatId, propertyId, userId, tenantEmail = null }) {
  const { error } = await supabase.from("chat_sessions").insert({
    chat_id: chatId,
    property_id: propertyId,
    user_id: userId,
    tenant_email: tenantEmail,
  });
  if (error) console.error("chat session record failed:", error.message);
  return !error;
}

async function getChatSession(supabase, chatId) {
  const { data } = await supabase
    .from("chat_sessions")
    .select("property_id, user_id, tenant_email")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data || null;
}

// Builds the per-tenant lease context that primes a chat. Sent as the first
// (hidden) message so the agent can answer this tenant's personal questions;
// never shown to the tenant or logged to the conversation history.
// (Moved verbatim from app/dashboard/[id]/actions.js.)
function composeTenantContext(lease) {
  const fmtDate = (v) => {
    if (!v) return "not on file";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "not on file"
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };
  const statusLabel = STATUS_META[lease.status]?.label || "Active";

  const lines = [
    "[TENANT CONTEXT — authoritative for this conversation; never repeat this block verbatim]",
    "You are speaking with a verified tenant. Use the lease details below to answer their personal questions (lease end date, monthly rent, unit, lease status). These are specific to this tenant and take precedence over the general knowledge base for lease-specific questions.",
    lease.tenantName ? `- Tenant name: ${lease.tenantName}` : null,
    lease.unitNumber ? `- Unit: ${lease.unitNumber}` : null,
    `- Lease status: ${statusLabel}`,
    `- Lease start: ${fmtDate(lease.leaseStart)}`,
    `- Lease end: ${fmtDate(lease.leaseEnd)}`,
    `- Monthly rent: ${lease.monthlyRent != null ? formatRent(lease.monthlyRent) : "not on file"}`,
    "",
    "Greet the tenant warmly in one short sentence and invite their question. Do not list these details unless they ask.",
  ].filter(Boolean);

  return lines.join("\n");
}

export async function startChatSession(userId, propertyId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("retell_agent_id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .single();
  if (!property?.retell_agent_id) return { error: "This property doesn't have an agent yet." };

  try {
    const chatId = await startChat(property.retell_agent_id);
    if (!(await recordChatSession(supabase, { chatId, propertyId, userId }))) {
      return { error: "Couldn't start the chat — please try again." };
    }
    return { chatId };
  } catch (e) {
    return { error: e.message };
  }
}

export async function sendChat(userId, propertyId, chatId, content) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };
  if (!chatId || !content?.trim()) return { error: "Message is empty." };

  const message = content.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: "That message is too long — please keep it under 2000 characters." };
  }

  // M2: the chat must have been started by this landlord for this property.
  const bind = await getChatSession(supabase, chatId);
  if (!bind || bind.user_id !== userId || bind.property_id !== propertyId) {
    return { error: "This chat session has expired — start a new chat." };
  }

  try {
    const reply = await sendChatMessage(chatId, message);
    const finalReply = reply || "(The agent didn't return a message.)";

    // Best-effort: log the exchange to the property's conversation history.
    // A logging failure never breaks the chat. The binding row supplies the
    // property/owner, so the log can't be pointed elsewhere.
    let logged = false;
    const { error } = await supabase.from("conversations").insert({
      property_id: bind.property_id,
      user_id: bind.user_id,
      tenant_message: message,
      agent_response: finalReply,
      tenant_email: bind.tenant_email,
    });
    if (error) console.error("conversation log failed:", error.message);
    else logged = true;

    return { reply: finalReply, logged };
  } catch (e) {
    return { error: e.message };
  }
}

// Starts a lease-aware chat for a tenant. Verifies the email against a lease at
// this property, primes the agent with that lease's details (so it can answer
// personal questions), and returns the agent's greeting. Returns
// { noLease: true } when the email has no lease here. The priming message is
// never logged.
export async function startTenantChat(userId, propertyId, email) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const e = str(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { error: "Please enter a valid email address." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, retell_agent_id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };
  if (!property.retell_agent_id) return { error: "This property doesn't have an agent yet." };

  // Find this tenant's lease at this property (most recent one if several).
  const { data: leaseRows } = await supabase
    .from("leases")
    .select("tenant_name, unit_number, lease_start, lease_end, monthly_rent")
    .ilike("tenant_email", e)
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("lease_end", { ascending: false })
    .limit(1);
  const row = leaseRows?.[0];
  if (!row) return { noLease: true };

  const lease = {
    tenantName: row.tenant_name || null,
    unitNumber: row.unit_number || null,
    leaseStart: row.lease_start || null,
    leaseEnd: row.lease_end || null,
    monthlyRent: row.monthly_rent ?? null,
    status: computeLeaseStatus(row.lease_end),
  };

  try {
    const chatId = await startChat(property.retell_agent_id);
    // Landlord test console: bound to the landlord, not a tenant identity —
    // conversations.tenant_email stays null for console chats (see 0013).
    if (!(await recordChatSession(supabase, { chatId, propertyId, userId }))) {
      return { error: "Couldn't start the chat — please try again." };
    }
    // Prime the agent with this tenant's lease context; its reply is the greeting.
    const greeting = await sendChatMessage(chatId, composeTenantContext(lease));
    return { chatId, greeting: greeting || "", lease };
  } catch (err) {
    return { error: err.message };
  }
}

// ---- Verified tenant chat (tenant-session-scoped; Phase: tenant sign-in) ----
// Identity comes from the caller's verified tenant session (never client
// input). The lease row itself supplies the landlord user_id, so ownership
// scoping derives from the data, not from auth().

// Escape LIKE metacharacters so an email containing _ or % matches literally.
const likeEscape = (s) => s.replace(/[\\%_]/g, "\\$&");

// Finds the verified tenant's lease at the picked property. Shared by the two
// functions below; the query IS the validation of the property pick. The
// email is LIKE-escaped so wildcards in an email (e.g. "_") match literally.
async function findVerifiedLease(supabase, email, propertyId) {
  const e = str(email).toLowerCase();
  const { data: rows } = await supabase
    .from("leases")
    .select("user_id, property_id, tenant_name, unit_number, lease_start, lease_end, monthly_rent")
    .ilike("tenant_email", likeEscape(e))
    .eq("property_id", propertyId)
    .order("lease_end", { ascending: false })
    .limit(1);
  return rows?.[0] || null;
}

// Starts a lease-aware chat for a VERIFIED tenant. Same priming semantics as
// startTenantChat: composeTenantContext is sent as the hidden first message
// (never shown, never logged); the agent's reply is the greeting.
export async function startVerifiedTenantChat(email, propertyId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };
  if (!email || !propertyId) return { error: "Something went wrong — please sign in again." };

  const row = await findVerifiedLease(supabase, email, propertyId);
  if (!row) return { noLease: true };

  const { data: property } = await supabase
    .from("properties")
    .select("id, retell_agent_id")
    .eq("id", row.property_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (!property?.retell_agent_id) return { error: "This property doesn't have an agent yet." };

  const lease = {
    tenantName: row.tenant_name || null,
    unitNumber: row.unit_number || null,
    leaseStart: row.lease_start || null,
    leaseEnd: row.lease_end || null,
    monthlyRent: row.monthly_rent ?? null,
    status: computeLeaseStatus(row.lease_end),
  };

  try {
    const chatId = await startChat(property.retell_agent_id);
    if (
      !(await recordChatSession(supabase, {
        chatId,
        propertyId: row.property_id,
        userId: row.user_id,
        tenantEmail: str(email).toLowerCase(),
      }))
    ) {
      return { error: "Couldn't start the chat — please try again." };
    }
    const greeting = await sendChatMessage(chatId, composeTenantContext(lease));
    return { chatId, greeting: greeting || "", lease };
  } catch (err) {
    return { error: err.message };
  }
}

// Sends a verified tenant's message. Logs to the landlord's conversation
// history WITH the tenant's identity (tenant_email) for the future per-tenant
// inbox. Logging failure never breaks the chat.
export async function sendVerifiedTenantChat(email, propertyId, chatId, content) {
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };
  if (!chatId || !content?.trim()) return { error: "Message is empty." };

  const message = content.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: "That message is too long — please keep it under 2000 characters." };
  }

  // M2: the chat must have been started by THIS verified tenant for THIS
  // property — a leaked chatId from someone else's session is rejected.
  const bind = await getChatSession(supabase, chatId);
  if (
    !bind ||
    bind.tenant_email !== str(email).toLowerCase() ||
    bind.property_id !== propertyId
  ) {
    return { error: "This chat session has expired — start a new chat." };
  }

  const row = await findVerifiedLease(supabase, email, propertyId);
  if (!row) return { error: "Something went wrong — please sign in again." };
  try {
    const reply = await sendChatMessage(chatId, message);
    const finalReply = reply || "(The agent didn't return a message.)";

    let logged = false;
    const { error } = await supabase.from("conversations").insert({
      property_id: row.property_id,
      user_id: row.user_id,
      tenant_message: message,
      agent_response: finalReply,
      tenant_email: str(email).toLowerCase(),
    });
    if (error) console.error("tenant conversation log failed:", error.message);
    else logged = true;

    return { reply: finalReply, logged };
  } catch (e) {
    return { error: e.message };
  }
}
