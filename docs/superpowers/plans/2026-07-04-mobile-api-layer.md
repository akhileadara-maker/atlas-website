# Atlas Mobile API Layer (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the upcoming React Native app an authenticated `/api/mobile/*` HTTP boundary by extracting Server Action bodies into `lib/services/` and adding 17 thin Clerk-authenticated route handlers — with zero web behavior change.

**Architecture:** Each Server Action's domain logic moves to a plain async function in `lib/services/` taking `userId` as the first argument; the actions become thin wrappers that parse formData, call the service, and keep their web-only side effects (`revalidatePath`, `redirect`). New route handlers under `app/api/mobile/` call the same services and translate `{ error }` results into HTTP status codes. Approved design: `docs/superpowers/specs/2026-07-04-mobile-api-layer-design.md`.

**Tech Stack:** Next.js 15 App Router (JS, no TS), `@clerk/nextjs` v7 (`auth()`, `currentUser()`, `clerkMiddleware`), Supabase service-role client via `lib/supabase.js`, Retell via `lib/retell.js`, Stripe via `lib/stripe.js`, Resend via `lib/notifications.js`.

## Global Constraints

- **Rule 1 (spec):** Do not remove or break any existing web functionality. Only these existing files may be modified: `app/dashboard/actions.js`, `app/dashboard/[id]/actions.js`, `app/dashboard/billing/actions.js`, `middleware.js`. Everything else existing is read-only.
- **Rule 2 (spec):** Reuse the existing backend clients in `lib/` — never re-create Supabase/Retell/Stripe/Resend clients.
- Plain JavaScript only (repo is JS, not TS). No new npm dependencies.
- Preserve today's exact user-facing strings: `"You must be signed in."`, `"The database isn't configured."`, `"The database isn't configured. Set the Supabase environment variables."` (addProperty only), `"Property name is required."`, `"Tenant name is required."`, `"A title is required."`, `"Property not found."`, `"Invalid status."`, `"Message is empty."`, `"Please enter a valid email address."`, `"This property doesn't have an agent yet."`, `"Unknown plan."`, `"Billing isn't configured (missing Stripe/Supabase env vars)."`, `"Saved your info, but updating the AI agent failed: "` + message.
- `userId` comes ONLY from `await auth()` (Clerk). Never from a request body or form field.
- Services return the same shapes actions return today (`{ error }`, `{ success: true }`, `{ chatId }`, `{ reply }`, `{ noLease: true }`, `{ url }`, …). Web actions must keep their exported names and signatures byte-compatible.
- Best-effort side effects preserved exactly: Retell agent create/teardown/sync never blocks the DB write; Resend email failures are `console.error`'d, never thrown; conversation-log failures never break chat; the chat priming message is never logged to `conversations`.
- **No test framework exists in this repo and none is added in this phase** (per the approved design doc). Verification per task = `npm run build` + manual web smoke + `curl`. This overrides the default TDD step structure.
- Commits go on `main` (matches repo practice — see `git log`). One commit per task, message prefixes `refactor:` / `feat:` as given.

### Dev-server + curl prerequisites (referenced by Tasks 6–13)

Run the app from the repo root (`Atlas_Website/`): `npm run dev` → http://localhost:3000. Env vars are in `.env.local` (already present).

To call authenticated `/api/mobile/*` endpoints with curl: sign in to http://localhost:3000/dashboard in a browser, open DevTools console, run `await window.Clerk.session.getToken()`, and copy the JWT. **Clerk session tokens expire after ~60 seconds** — re-run the console line whenever you start getting 401s.

```bash
BASE=http://localhost:3000
TOKEN="<paste output of: await window.Clerk.session.getToken()>"
# example:
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/dashboard"
```

To get a real property id for path params: copy it from a dashboard property URL (`/dashboard/<id>`). For "foreign id → 404" tests use a random UUID: `00000000-0000-0000-0000-000000000000`.

---

### Task 1: Properties service + delegate property actions

**Files:**
- Create: `lib/services/properties.js`
- Modify: `app/dashboard/actions.js` (whole file — shown below)
- Modify: `app/dashboard/[id]/actions.js` (replace `updateProperty`, `deleteProperty`, `saveKnowledgeBase`; delete `composeSystemPrompt`, `composeKbText`; adjust imports)

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase`; `createPropertyAgent`, `updateKnowledgeBaseContent`, `updateAgentSystemPrompt`, `updateAgentLanguage`, `deletePropertyAgent` from `@/lib/retell`.
- Produces (used by Tasks 7–8 and the actions):
  - `createProperty(userId, { name, address, units })` → `{ success: true, id }` | `{ error }`
  - `updatePropertyDetails(userId, id, { name, address, units })` → `{ success: true }` | `{ error }`
  - `deletePropertyById(userId, id)` → `{ success: true }` | `{ error }`
  - `saveKnowledgeBase(userId, id, input)` → `{ success: true }` | `{ error }` (input: any object; the service normalizes the 11 kb fields itself)

- [ ] **Step 1: Create `lib/services/properties.js`**

```js
import "server-only";
import { getSupabase } from "@/lib/supabase";
import {
  createPropertyAgent,
  updateKnowledgeBaseContent,
  updateAgentSystemPrompt,
  updateAgentLanguage,
  deletePropertyAgent,
} from "@/lib/retell";

const str = (v) => (v == null ? "" : v.toString().trim());

// Build the agent's system prompt — re-injected into Retell on every KB save.
// (Moved verbatim from app/dashboard/[id]/actions.js.)
function composeSystemPrompt(propertyName, language) {
  const lines = [
    `You are Atlas, the AI assistant for ${propertyName}.`,
    "You help tenants with questions about their property, lease, policies, and maintenance.",
    "",
    "Rules:",
    "- Answer general property questions ONLY using information from the knowledge base. Never guess or make up facts.",
    "- If the tenant's own lease details are provided to you in this conversation, use them to answer their personal questions (their lease end date, monthly rent, unit, and lease status).",
    `- If you don't know the answer, or it isn't in the knowledge base or the tenant's lease details, reply exactly: "I'll flag this for your property manager." and escalate the question to a human.`,
    "- Be professional, but warm and friendly.",
    "- Always reply in the same language the tenant writes in.",
  ];
  if (language) {
    lines.push(
      `- This property's preferred language is ${language}; default to it when the tenant's language is unclear.`
    );
  }
  return lines.join("\n");
}

// Build the plain-text document that gets pushed to the Retell knowledge base.
// (Moved verbatim from app/dashboard/[id]/actions.js.)
function composeKbText(property, kb) {
  const lines = [`Property: ${property.name}`];
  if (property.address) lines.push(`Address: ${property.address}`);
  lines.push(`Number of units: ${property.units}`, "");

  if (kb.monthly_rent) lines.push(`Monthly rent: ${kb.monthly_rent}`);
  if (kb.late_fee || kb.grace_period) {
    lines.push(
      `Late fee: ${kb.late_fee || "N/A"}` +
        (kb.grace_period ? ` (after a ${kb.grace_period}-day grace period)` : "")
    );
  }
  const petsAllowed = kb.pet_allowed === "yes";
  let pets = `Pet policy: ${petsAllowed ? "Pets allowed" : "No pets allowed"}`;
  if (petsAllowed) {
    if (kb.pet_deposit) pets += `; pet deposit ${kb.pet_deposit}`;
    if (kb.pet_monthly_fee) pets += `; monthly pet fee ${kb.pet_monthly_fee}`;
  }
  lines.push(pets);
  if (kb.maintenance_contact) lines.push(`Maintenance emergency contact: ${kb.maintenance_contact}`);
  if (kb.office_hours) lines.push(`Office hours: ${kb.office_hours}`);
  if (kb.parking_policy) lines.push(`Parking policy: ${kb.parking_policy}`);
  if (kb.custom_notes) lines.push(`Additional rules and notes: ${kb.custom_notes}`);
  return lines.join("\n");
}

// Insert a property for this landlord, then (best-effort) spin up its Retell
// knowledge base + chat agent. On Retell failure the property is still saved
// and clients show "Agent pending".
export async function createProperty(userId, { name, address, units }) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "The database isn't configured. Set the Supabase environment variables." };
  }

  const cleanName = str(name);
  const cleanAddress = str(address);
  const unitsRaw = parseInt(units, 10);
  const cleanUnits = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;

  if (!cleanName) return { error: "Property name is required." };

  const { data: row, error } = await supabase
    .from("properties")
    .insert({ user_id: userId, name: cleanName, address: cleanAddress || null, units: cleanUnits })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    const { agentId, kbId } = await createPropertyAgent({ name: cleanName, address: cleanAddress });
    await supabase
      .from("properties")
      .update({ retell_agent_id: agentId, retell_kb_id: kbId })
      .eq("id", row.id);
  } catch (e) {
    console.error("Retell agent creation failed:", e.message);
  }

  return { success: true, id: row.id };
}

export async function updatePropertyDetails(userId, id, { name, address, units }) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const cleanName = str(name);
  const cleanAddress = str(address);
  const unitsRaw = parseInt(units, 10);
  const cleanUnits = Number.isFinite(unitsRaw) && unitsRaw >= 0 ? unitsRaw : 0;
  if (!cleanName) return { error: "Property name is required." };

  const { error } = await supabase
    .from("properties")
    .update({ name: cleanName, address: cleanAddress || null, units: cleanUnits })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true };
}

// Deletes the property (children cascade in Postgres) after best-effort Retell
// agent + KB teardown so nothing is orphaned.
export async function deletePropertyById(userId, id) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("retell_agent_id, retell_kb_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (property) {
    await deletePropertyAgent({
      agentId: property.retell_agent_id,
      kbId: property.retell_kb_id,
    });
  }

  const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true };
}

// Persists the structured KB fields, then pushes the latest info to the
// property's Retell agent: KB content + system prompt + language, so the agent
// never drifts from what the landlord saved.
export async function saveKnowledgeBase(userId, id, input) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const kb = {
    monthly_rent: str(input.monthly_rent),
    late_fee: str(input.late_fee),
    grace_period: str(input.grace_period),
    pet_allowed: str(input.pet_allowed) === "yes" ? "yes" : "no",
    pet_deposit: str(input.pet_deposit),
    pet_monthly_fee: str(input.pet_monthly_fee),
    maintenance_contact: str(input.maintenance_contact),
    office_hours: str(input.office_hours),
    parking_policy: str(input.parking_policy),
    custom_notes: str(input.custom_notes),
    preferred_language: str(input.preferred_language),
  };

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  const { error: upErr } = await supabase
    .from("properties")
    .update({ kb_data: kb })
    .eq("id", id)
    .eq("user_id", userId);
  if (upErr) return { error: upErr.message };

  if (property.retell_kb_id || property.retell_agent_id) {
    try {
      if (property.retell_kb_id) {
        await updateKnowledgeBaseContent(
          property.retell_kb_id,
          `${property.name} — property info`.slice(0, 60),
          composeKbText(property, kb)
        );
      }
      if (property.retell_agent_id) {
        await updateAgentSystemPrompt(
          property.retell_agent_id,
          composeSystemPrompt(property.name, kb.preferred_language)
        );
        await updateAgentLanguage(property.retell_agent_id, kb.preferred_language);
      }
    } catch (e) {
      return { error: "Saved your info, but updating the AI agent failed: " + e.message };
    }
  }

  return { success: true };
}
```

- [ ] **Step 2: Replace `app/dashboard/actions.js` with the delegating version (whole file)**

```js
"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createProperty } from "@/lib/services/properties";

// Server Action: thin wrapper — parses the form, delegates to the properties
// service (which owns the Supabase insert + best-effort Retell agent setup),
// then revalidates. user_id comes from the trusted Clerk session, never the form.
export async function addProperty(prevState, formData) {
  const { userId } = await auth();

  const result = await createProperty(userId, {
    name: formData.get("name"),
    address: formData.get("address"),
    units: formData.get("units"),
  });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  return { success: true };
}
```

- [ ] **Step 3: Delegate the three property actions in `app/dashboard/[id]/actions.js`**

Delete the `composeSystemPrompt` and `composeKbText` function definitions (they moved to the service). Replace the `updateProperty`, `deleteProperty`, and `saveKnowledgeBase` exports with:

```js
export async function updateProperty(prevState, formData) {
  const { userId } = await auth();
  const id = str(formData.get("id"));

  const result = await updatePropertyDetails(userId, id, {
    name: formData.get("name"),
    address: formData.get("address"),
    units: formData.get("units"),
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProperty(id) {
  const { userId } = await auth();

  const result = await deletePropertyById(userId, id);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function saveKnowledgeBase(prevState, formData) {
  const { userId } = await auth();
  const id = str(formData.get("id"));

  const result = await saveKnowledgeBaseService(userId, id, Object.fromEntries(formData));
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${id}`);
  return { success: true };
}
```

Update the import block at the top of the file to exactly:

```js
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { saveNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { startChat, sendChatMessage } from "@/lib/retell";
import { computeLeaseStatus, formatRent, STATUS_META } from "@/lib/leases";
import { URGENCY_OPTIONS, STATUS_OPTIONS } from "@/lib/maintenance";
import {
  updatePropertyDetails,
  deletePropertyById,
  saveKnowledgeBase as saveKnowledgeBaseService,
} from "@/lib/services/properties";
```

(`updateKnowledgeBaseContent`, `updateAgentSystemPrompt`, `updateAgentLanguage`, `deletePropertyAgent` drop out of the `@/lib/retell` import — the remaining chat/lease/maintenance actions are untouched in this task and still need everything else, including the `str` helper and `requireUserAndDb`.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiles with no errors (warnings about env vars are pre-existing and fine).

- [ ] **Step 5: Web smoke test**

`npm run dev`, sign in at http://localhost:3000/dashboard, then verify:
1. Add a property (name + address + units) → appears in list; "Test Agent" link appears after a few seconds (Retell configured) or "Agent pending" (also acceptable).
2. Open it → edit the name → Save → name updates on detail + dashboard.
3. Knowledge Base: set e.g. monthly rent + pet policy → Save → success state, no error.
4. Delete the property → redirected to /dashboard, property gone.

- [ ] **Step 6: Commit**

```bash
git add lib/services/properties.js app/dashboard/actions.js "app/dashboard/[id]/actions.js"
git commit -m "refactor: extract property logic into lib/services/properties"
```

---

### Task 2: Leases service + delegate lease actions

**Files:**
- Create: `lib/services/leases.js`
- Modify: `app/dashboard/[id]/actions.js` (replace `addLease`, `deleteLease`, `refreshLeaseStatuses`; adjust imports)

**Interfaces:**
- Consumes: `getSupabase()`; `computeLeaseStatus` from `@/lib/leases`.
- Produces (used by Task 9 and the actions):
  - `createLease(userId, propertyId, fields)` → `{ success: true }` | `{ error }` (fields: raw object; service normalizes)
  - `removeLease(userId, leaseId)` → `{ success: true, propertyId }` | `{ error }` (`propertyId` may be null)
  - `refreshLeaseStatuses(userId, propertyId)` → `boolean` (true if any row's status changed)

- [ ] **Step 1: Create `lib/services/leases.js`**

```js
import "server-only";
import { getSupabase } from "@/lib/supabase";
import { computeLeaseStatus } from "@/lib/leases";

const str = (v) => (v == null ? "" : v.toString().trim());

export async function createLease(userId, propertyId, fields) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const tenant_name = str(fields.tenant_name);
  if (!tenant_name) return { error: "Tenant name is required." };

  // Confirm the property belongs to this user before attaching a lease.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const lease_end = str(fields.lease_end) || null;
  const rent = parseFloat(fields.monthly_rent);

  const { error } = await supabase.from("leases").insert({
    property_id: propertyId,
    user_id: userId,
    tenant_name,
    tenant_email: str(fields.tenant_email) || null,
    unit_number: str(fields.unit_number) || null,
    monthly_rent: Number.isFinite(rent) ? rent : null,
    lease_start: str(fields.lease_start) || null,
    lease_end,
    status: computeLeaseStatus(lease_end),
  });
  if (error) return { error: error.message };

  return { success: true };
}

export async function removeLease(userId, leaseId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: lease } = await supabase
    .from("leases")
    .select("property_id")
    .eq("id", leaseId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("leases").delete().eq("id", leaseId).eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true, propertyId: lease?.property_id || null };
}

// Recompute each lease's stored status from its end date; only writes rows
// whose status changed. Returns true if anything changed.
export async function refreshLeaseStatuses(userId, propertyId) {
  if (!userId) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data: leases } = await supabase
    .from("leases")
    .select("id, lease_end, status")
    .eq("property_id", propertyId)
    .eq("user_id", userId);

  let changed = false;
  for (const lease of leases || []) {
    const next = computeLeaseStatus(lease.lease_end);
    if (next !== lease.status) {
      await supabase.from("leases").update({ status: next }).eq("id", lease.id).eq("user_id", userId);
      changed = true;
    }
  }
  return changed;
}
```

- [ ] **Step 2: Delegate the three lease actions in `app/dashboard/[id]/actions.js`**

Replace the `addLease`, `deleteLease`, and `refreshLeaseStatuses` exports with:

```js
export async function addLease(prevState, formData) {
  const { userId } = await auth();
  const propertyId = str(formData.get("property_id"));

  const result = await createLease(userId, propertyId, Object.fromEntries(formData));
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteLease(leaseId) {
  const { userId } = await auth();

  const result = await removeLease(userId, leaseId);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}

export async function refreshLeaseStatuses(propertyId) {
  const { userId } = await auth();
  const changed = await refreshLeaseStatusesService(userId, propertyId);
  if (changed) revalidatePath(`/dashboard/${propertyId}`);
}
```

Add to the import block:

```js
import {
  createLease,
  removeLease,
  refreshLeaseStatuses as refreshLeaseStatusesService,
} from "@/lib/services/leases";
```

(Keep the `computeLeaseStatus, formatRent, STATUS_META` import from `@/lib/leases` — `startTenantChat` still uses them until Task 4.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Web smoke test**

On a property detail page:
1. Add a lease with an end date ~30 days out → appears with gold "Expiring soon" badge.
2. Add a lease with an end date next year → green "Active" badge.
3. Delete one lease → row disappears.

- [ ] **Step 5: Commit**

```bash
git add lib/services/leases.js "app/dashboard/[id]/actions.js"
git commit -m "refactor: extract lease logic into lib/services/leases"
```

---

### Task 3: Maintenance service + delegate dispatch actions

**Files:**
- Create: `lib/services/maintenance.js`
- Modify: `app/dashboard/[id]/actions.js` (replace `addMaintenanceRequest`, `deleteMaintenanceRequest`, `updateMaintenanceStatus`; adjust imports)

**Interfaces:**
- Consumes: `getSupabase()`; `URGENCY_OPTIONS`, `STATUS_OPTIONS` from `@/lib/maintenance`; `saveNotificationEmail` from `@/lib/profiles`; `sendMaintenanceRequestEmail` from `@/lib/notifications`.
- Produces (used by Task 10 and the actions):
  - `createRequest(userId, propertyId, { title, description, urgency }, { landlordEmail } = {})` → `{ success: true }` | `{ error }`
  - `updateRequestStatus(userId, requestId, status)` → `{ success: true, propertyId }` | `{ error }`
  - `removeRequest(userId, requestId)` → `{ success: true, propertyId }` | `{ error }`

- [ ] **Step 1: Create `lib/services/maintenance.js`**

```js
import "server-only";
import { getSupabase } from "@/lib/supabase";
import { saveNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { URGENCY_OPTIONS, STATUS_OPTIONS } from "@/lib/maintenance";

const str = (v) => (v == null ? "" : v.toString().trim());

// Insert a maintenance request, then best-effort email the landlord (and keep
// their notification email fresh). An email failure never fails the request.
export async function createRequest(userId, propertyId, { title, description, urgency }, { landlordEmail } = {}) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const cleanTitle = str(title);
  const cleanDescription = str(description);
  if (!cleanTitle) return { error: "A title is required." };

  const { data: property } = await supabase
    .from("properties")
    .select("id, name")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const urgencyInput = str(urgency);
  const cleanUrgency = URGENCY_OPTIONS.includes(urgencyInput) ? urgencyInput : "normal";

  const { error } = await supabase.from("maintenance_requests").insert({
    property_id: propertyId,
    user_id: userId,
    title: cleanTitle,
    description: cleanDescription || null,
    urgency: cleanUrgency,
    status: "open",
  });
  if (error) return { error: error.message };

  try {
    if (landlordEmail) {
      await saveNotificationEmail(userId, landlordEmail);
      await sendMaintenanceRequestEmail({
        to: landlordEmail,
        propertyId,
        propertyName: property.name,
        request: { title: cleanTitle, description: cleanDescription, urgency: cleanUrgency },
      });
    }
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  return { success: true };
}

export async function updateRequestStatus(userId, requestId, status) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };
  if (!STATUS_OPTIONS.includes(status)) return { error: "Invalid status." };

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("property_id")
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true, propertyId: request?.property_id || null };
}

export async function removeRequest(userId, requestId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select("property_id")
    .eq("id", requestId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("maintenance_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true, propertyId: request?.property_id || null };
}
```

- [ ] **Step 2: Delegate the three dispatch actions in `app/dashboard/[id]/actions.js`**

Replace the `addMaintenanceRequest`, `deleteMaintenanceRequest`, and `updateMaintenanceStatus` exports with:

```js
export async function addMaintenanceRequest(prevState, formData) {
  const { userId } = await auth();
  const propertyId = str(formData.get("property_id"));

  // Resolve the landlord's email up front (best-effort) so the service can
  // send the notification; a Clerk hiccup must never block the request.
  let landlordEmail = null;
  try {
    const user = await currentUser();
    landlordEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  const result = await createRequest(
    userId,
    propertyId,
    {
      title: formData.get("title"),
      description: formData.get("description"),
      urgency: formData.get("urgency"),
    },
    { landlordEmail }
  );
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/${propertyId}`);
  return { success: true };
}

export async function deleteMaintenanceRequest(requestId) {
  const { userId } = await auth();

  const result = await removeRequest(userId, requestId);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}

export async function updateMaintenanceStatus(requestId, status) {
  const { userId } = await auth();

  const result = await updateRequestStatus(userId, requestId, status);
  if (result.error) return { error: result.error };

  if (result.propertyId) revalidatePath(`/dashboard/${result.propertyId}`);
  return { success: true };
}
```

Import changes: remove the `saveNotificationEmail` (from `@/lib/profiles`), `sendMaintenanceRequestEmail` (from `@/lib/notifications`), and `URGENCY_OPTIONS, STATUS_OPTIONS` (from `@/lib/maintenance`) imports — the service owns them now. Add:

```js
import { createRequest, updateRequestStatus, removeRequest } from "@/lib/services/maintenance";
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Web smoke test**

On a property detail page:
1. Add a request titled "Leaky faucet", urgency Urgent → card appears with coral Urgent badge; the landlord email arrives (check the inbox for the signed-in account; requires Resend configured — if not, console shows no crash).
2. Change its status to In progress → badge updates instantly.
3. Delete it → card disappears.

- [ ] **Step 5: Commit**

```bash
git add lib/services/maintenance.js "app/dashboard/[id]/actions.js"
git commit -m "refactor: extract maintenance logic into lib/services/maintenance"
```

---

### Task 4: Chat service + delegate chat actions

**Files:**
- Create: `lib/services/chat.js`
- Modify: `app/dashboard/[id]/actions.js` (replace `startChatSession`, `sendChat`, `startTenantChat`; delete `composeTenantContext`, `requireUserAndDb`; final import cleanup)

**Interfaces:**
- Consumes: `getSupabase()`; `startChat`, `sendChatMessage` from `@/lib/retell`; `computeLeaseStatus`, `formatRent`, `STATUS_META` from `@/lib/leases`.
- Produces (used by Task 11 and the actions):
  - `startChatSession(userId, propertyId)` → `{ chatId }` | `{ error }`
  - `sendChat(userId, propertyId, chatId, content)` → `{ reply, logged }` | `{ error }` (`logged`: boolean — whether a `conversations` row was written; callers must NOT expose it to clients)
  - `startTenantChat(userId, propertyId, email)` → `{ chatId, greeting, lease }` | `{ noLease: true }` | `{ error }`

- [ ] **Step 1: Create `lib/services/chat.js`**

```js
import "server-only";
import { getSupabase } from "@/lib/supabase";
import { startChat, sendChatMessage } from "@/lib/retell";
import { computeLeaseStatus, formatRent, STATUS_META } from "@/lib/leases";

const str = (v) => (v == null ? "" : v.toString().trim());

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
    return { chatId };
  } catch (e) {
    return { error: e.message };
  }
}

export async function sendChat(userId, propertyId, chatId, content) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!chatId || !content?.trim()) return { error: "Message is empty." };

  const message = content.trim();
  try {
    const reply = await sendChatMessage(chatId, message);
    const finalReply = reply || "(The agent didn't return a message.)";

    // Best-effort: log the exchange to the property's conversation history.
    // A logging failure (e.g. table not created yet) never breaks the chat.
    let logged = false;
    if (supabase && propertyId) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (property) {
        const { error } = await supabase.from("conversations").insert({
          property_id: propertyId,
          user_id: userId,
          tenant_message: message,
          agent_response: finalReply,
        });
        if (error) console.error("conversation log failed:", error.message);
        else logged = true;
      }
    }

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
    // Prime the agent with this tenant's lease context; its reply is the greeting.
    const greeting = await sendChatMessage(chatId, composeTenantContext(lease));
    return { chatId, greeting: greeting || "", lease };
  } catch (err) {
    return { error: err.message };
  }
}
```

- [ ] **Step 2: Delegate the three chat actions and finish cleanup in `app/dashboard/[id]/actions.js`**

Replace the `startChatSession`, `sendChat`, and `startTenantChat` exports with:

```js
export async function startChatSession(propertyId) {
  const { userId } = await auth();
  return startChatSessionService(userId, propertyId);
}

export async function sendChat(propertyId, chatId, content) {
  const { userId } = await auth();

  const result = await sendChatService(userId, propertyId, chatId, content);
  if (result.error) return { error: result.error };

  if (result.logged) revalidatePath(`/dashboard/${propertyId}`);
  return { reply: result.reply };
}

export async function startTenantChat(propertyId, email) {
  const { userId } = await auth();
  return startTenantChatService(userId, propertyId, email);
}
```

Delete the `composeTenantContext` and `requireUserAndDb` function definitions (no callers remain). The file's ENTIRE import block and helper section is now exactly:

```js
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updatePropertyDetails,
  deletePropertyById,
  saveKnowledgeBase as saveKnowledgeBaseService,
} from "@/lib/services/properties";
import {
  createLease,
  removeLease,
  refreshLeaseStatuses as refreshLeaseStatusesService,
} from "@/lib/services/leases";
import { createRequest, updateRequestStatus, removeRequest } from "@/lib/services/maintenance";
import {
  startChatSession as startChatSessionService,
  sendChat as sendChatService,
  startTenantChat as startTenantChatService,
} from "@/lib/services/chat";

const str = (v) => (v == null ? "" : v.toString().trim());
```

(All `@/lib/supabase`, `@/lib/retell`, `@/lib/leases`, `@/lib/maintenance`, `@/lib/profiles`, `@/lib/notifications` imports are gone — the services own them. The file should now contain ONLY the 12 exported delegating actions plus the `str` helper.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Web smoke test**

On a property with an agent and a lease whose `tenant_email` you control:
1. Chat tab → enter that tenant email → greeting appears; ask "when does my lease end?" → correct date from the lease.
2. Ask a general question → answered from KB; conversation appears in the Conversations log (the greeting/priming exchange must NOT appear there).
3. "Switch email" → enter an email with no lease → "couldn't find a lease" state (mirrors web copy), no crash.

- [ ] **Step 5: Commit**

```bash
git add lib/services/chat.js "app/dashboard/[id]/actions.js"
git commit -m "refactor: extract chat logic into lib/services/chat"
```

---

### Task 5: Billing service + delegate checkout action

**Files:**
- Create: `lib/services/billing.js`
- Modify: `app/dashboard/billing/actions.js` (whole file — shown below)

**Interfaces:**
- Consumes: `getStripe()` from `@/lib/stripe`; `getSupabase()`; `getUnitCount` from `@/lib/subscription`; `PLANS` from `@/lib/plans`.
- Produces (used by Task 12 and the action):
  - `createCheckoutSession(userId, planKey, { baseUrl, email })` → `{ url }` | `{ error }`

- [ ] **Step 1: Create `lib/services/billing.js`**

```js
import "server-only";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { getUnitCount } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";

// Creates a Stripe Checkout session for a subscription billed per unit
// (quantity = total units across the landlord's properties). Reuses the
// existing Stripe customer when one is on file. `baseUrl`/`email` are supplied
// by the caller because they come from the web request context.
export async function createCheckoutSession(userId, planKey, { baseUrl, email }) {
  if (!userId) return { error: "You must be signed in." };

  const stripe = getStripe();
  const supabase = getSupabase();
  if (!stripe || !supabase) return { error: "Billing isn't configured (missing Stripe/Supabase env vars)." };

  const plan = PLANS[planKey];
  if (!plan) return { error: "Unknown plan." };

  const units = await getUnitCount(userId);
  const quantity = Math.max(1, units);

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity }],
      success_url: `${baseUrl}/dashboard/billing?success=1`,
      cancel_url: `${baseUrl}/dashboard/billing?canceled=1`,
      metadata: { userId, plan: planKey },
      subscription_data: { metadata: { userId, plan: planKey } },
    });
    return { url: session.url };
  } catch (e) {
    return { error: e.message };
  }
}
```

- [ ] **Step 2: Replace `app/dashboard/billing/actions.js` with the delegating version (whole file)**

```js
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { createCheckoutSession as createCheckoutSessionService } from "@/lib/services/billing";

async function baseUrl() {
  const h = await headers();
  const host = h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function createCheckoutSession(planKey) {
  const { userId } = await auth();
  if (!userId) return { error: "You must be signed in." };

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  return createCheckoutSessionService(userId, planKey, { baseUrl: await baseUrl(), email });
}
```

(Note: the original resolved `currentUser()` only when creating a new Stripe customer; resolving it up front is one extra Clerk lookup on a user-initiated click — an accepted, behavior-neutral simplification recorded here deliberately.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Web smoke test**

1. /dashboard/billing → pick a plan → Subscribe → Stripe Checkout page opens with the right plan and quantity = your total units (min 1).
2. Cancel → back at billing with the "Checkout canceled" banner.

- [ ] **Step 5: Commit**

```bash
git add lib/services/billing.js app/dashboard/billing/actions.js
git commit -m "refactor: extract checkout logic into lib/services/billing"
```

---

### Task 6: Mobile API helper + middleware 401 matcher

**Files:**
- Create: `lib/mobile-api.js`
- Modify: `middleware.js` (whole file — shown below)

**Interfaces:**
- Consumes: `auth()` from `@clerk/nextjs/server`; `NextResponse` from `next/server`.
- Produces (used by every route in Tasks 7–12):
  - `requireUserId()` → `{ userId: string, response: null }` | `{ userId: null, response: NextResponse(401) }`
  - `serviceResponse(result)` → `NextResponse` — passes success payloads through as 200 JSON; maps `{ error }` messages to 400/401/404/502/503 per the design doc

- [ ] **Step 1: Create `lib/mobile-api.js`**

```js
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Resolve the caller's Clerk userId (from the Authorization: Bearer token the
// mobile app sends). Returns a ready-to-return 401 response when missing.
export async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "You must be signed in." }, { status: 401 }),
    };
  }
  return { userId, response: null };
}

// Map a service-layer error message to an HTTP status. Services return the
// exact message strings the web Server Actions show, so this keys on those
// phrasings (see design doc "Error / status conventions").
function statusForError(message) {
  if (/not found/i.test(message)) return 404;
  if (/isn't configured/i.test(message)) return 503;
  if (/signed in/i.test(message)) return 401;
  if (/required|invalid|valid email|empty|unknown plan|doesn't have an agent/i.test(message)) return 400;
  return 502; // upstream (Retell/Stripe) or unexpected failure
}

// Turn a service result ({ error } or a success payload) into a JSON response.
export function serviceResponse(result) {
  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: statusForError(result.error) });
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Replace `middleware.js` (whole file)**

```js
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Only /dashboard requires auth; the marketing pages stay public.
const isProtected = createRouteMatcher(["/dashboard(.*)"]);
// The mobile API is auth-required too, but API clients get a JSON 401 —
// never a sign-in redirect.
const isMobileApi = createRouteMatcher(["/api/mobile(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isMobileApi(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }
    return;
  }
  if (isProtected(req)) {
    // Send signed-out visitors to sign-in instead of showing a 404.
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files; run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

(The `config.matcher` is byte-identical to today's — `/api/...` was already matched; only the handler gains the mobile branch.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Verify with curl**

With `npm run dev` running:

```bash
curl -si http://localhost:3000/api/mobile/dashboard | head -3
```
Expected: `HTTP/1.1 401 Unauthorized` and body `{"error":"You must be signed in."}` (the route doesn't exist yet — the middleware answers first, which is the point).

Also verify web is unaffected: load http://localhost:3000/ (marketing, no auth) and /dashboard (still redirects to sign-in when signed out; loads when signed in).

- [ ] **Step 5: Commit**

```bash
git add lib/mobile-api.js middleware.js
git commit -m "feat: mobile API auth helper + 401 middleware for /api/mobile"
```

---

### Task 7: Dashboard endpoint

**Files:**
- Modify: `lib/services/properties.js` (append `getDashboardData`)
- Create: `app/api/mobile/dashboard/route.js`

**Interfaces:**
- Consumes: `requireUserId`, `serviceResponse` from `@/lib/mobile-api`; `saveNotificationEmail` from `@/lib/profiles`; `currentUser` from `@clerk/nextjs/server`.
- Produces: `getDashboardData(userId)` → `{ stats: { totalUnits, activeLeases, openRequests, expiringSoon }, properties: [{ id, name, address, units, created_at, agentReady, leaseCount, openRequestCount }] }` | `{ error }`. Route: `GET /api/mobile/dashboard`.

- [ ] **Step 1: Append `getDashboardData` to `lib/services/properties.js`**

Add `computeLeaseStatus` to the file's imports:

```js
import { computeLeaseStatus } from "@/lib/leases";
```

Append:

```js
// Everything the dashboard (web or mobile) shows: the four stat cards plus the
// property list with per-property lease/open-request counts. Mirrors the
// queries in app/dashboard/page.js (which stays as-is per the design doc).
export async function getDashboardData(userId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: propertyRows, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  const properties = propertyRows || [];

  const [leaseRes, reqRes] = await Promise.all([
    supabase.from("leases").select("property_id, lease_end").eq("user_id", userId),
    supabase.from("maintenance_requests").select("property_id, status").eq("user_id", userId),
  ]);
  const leases = leaseRes.data || [];
  const requests = reqRes.data || [];

  const leasesByProperty = {};
  for (const l of leases) leasesByProperty[l.property_id] = (leasesByProperty[l.property_id] || 0) + 1;
  const openReqByProperty = {};
  for (const r of requests) {
    if (r.status !== "resolved") openReqByProperty[r.property_id] = (openReqByProperty[r.property_id] || 0) + 1;
  }

  return {
    stats: {
      totalUnits: properties.reduce((sum, p) => sum + (p.units || 0), 0),
      activeLeases: leases.filter((l) => computeLeaseStatus(l.lease_end) === "active").length,
      openRequests: requests.filter((r) => r.status !== "resolved").length,
      expiringSoon: leases.filter((l) => computeLeaseStatus(l.lease_end) === "expiring_soon").length,
    },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      units: p.units || 0,
      created_at: p.created_at,
      agentReady: Boolean(p.retell_agent_id),
      leaseCount: leasesByProperty[p.id] || 0,
      openRequestCount: openReqByProperty[p.id] || 0,
    })),
  };
}
```

- [ ] **Step 2: Create `app/api/mobile/dashboard/route.js`**

```js
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { getDashboardData } from "@/lib/services/properties";
import { saveNotificationEmail } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, response } = await requireUserId();
  if (response) return response;

  // Same best-effort side effect as the web dashboard: keep the landlord's
  // notification email fresh so maintenance/lease alerts have a recipient.
  try {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (email) await saveNotificationEmail(userId, email);
  } catch (e) {
    console.error("saveNotificationEmail failed:", e.message);
  }

  return serviceResponse(await getDashboardData(userId));
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors; route `/api/mobile/dashboard` listed in the output.

- [ ] **Step 4: Verify with curl**

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/dashboard" | python3 -m json.tool
```
Expected: 200 with `stats` (four numeric fields — 0s are fine, never null/NaN) and `properties` (array; each row has `agentReady`, `leaseCount`, `openRequestCount`). Cross-check the numbers against the web dashboard for the same account — they must match exactly.

```bash
curl -si "$BASE/api/mobile/dashboard" | head -1
```
Expected: `HTTP/1.1 401 Unauthorized`.

- [ ] **Step 5: Commit**

```bash
git add lib/services/properties.js app/api/mobile/dashboard/route.js
git commit -m "feat: GET /api/mobile/dashboard"
```

---

### Task 8: Property CRUD + KB endpoints

**Files:**
- Modify: `lib/services/properties.js` (append `getProperty`)
- Create: `app/api/mobile/properties/route.js`
- Create: `app/api/mobile/properties/[id]/route.js`
- Create: `app/api/mobile/properties/[id]/kb/route.js`

**Interfaces:**
- Consumes: Task 1 service functions; `requireUserId`, `serviceResponse`; `notifyExpiringLeases` from `@/lib/notifications`.
- Produces: `getProperty(userId, id)` → `{ property }` | `{ error }` (property = full row incl. `kb_data`). Routes: `POST /api/mobile/properties`, `GET|PATCH|DELETE /api/mobile/properties/:id`, `POST /api/mobile/properties/:id/kb`.

- [ ] **Step 1: Append `getProperty` to `lib/services/properties.js`**

Add to the file's imports:

```js
import { notifyExpiringLeases } from "@/lib/notifications";
```

Append:

```js
// One property (incl. kb_data) for the mobile detail screen. Mirrors the web
// property page's side effect: best-effort expiring-lease digest, deduped via
// expiry_notified_at so it never double-sends.
export async function getProperty(userId, id) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, user_id, tenant_name, unit_number, lease_end, expiry_notified_at")
    .eq("property_id", id)
    .eq("user_id", userId);
  await notifyExpiringLeases({ userId, property, leases: leases || [] });

  return { property };
}
```

- [ ] **Step 2: Create `app/api/mobile/properties/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { createProperty } from "@/lib/services/properties";

export async function POST(request) {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  return serviceResponse(
    await createProperty(userId, { name: body.name, address: body.address, units: body.units })
  );
}
```

- [ ] **Step 3: Create `app/api/mobile/properties/[id]/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import {
  getProperty,
  updatePropertyDetails,
  deletePropertyById,
} from "@/lib/services/properties";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await getProperty(userId, id));
}

export async function PATCH(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(
    await updatePropertyDetails(userId, id, { name: body.name, address: body.address, units: body.units })
  );
}

export async function DELETE(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await deletePropertyById(userId, id));
}
```

- [ ] **Step 4: Create `app/api/mobile/properties/[id]/kb/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { saveKnowledgeBase } from "@/lib/services/properties";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await saveKnowledgeBase(userId, id, body));
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: no errors; the three new routes listed.

- [ ] **Step 6: Verify with curl**

```bash
# Create (expect 200, {"success":true,"id":"..."} — note the id as PID)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Curl Test Property","address":"1 API Way","units":3}' \
  "$BASE/api/mobile/properties"

# Validation (expect 400 {"error":"Property name is required."})
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":""}' "$BASE/api/mobile/properties" | head -1

# Read (expect 200 with full row incl. kb_data)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/properties/$PID" | python3 -m json.tool

# Foreign id (expect 404 {"error":"Property not found."})
curl -si -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/mobile/properties/00000000-0000-0000-0000-000000000000" | head -1

# Update (expect {"success":true}; verify the name changed on the WEB dashboard too)
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Curl Test Property v2","address":"1 API Way","units":4}' \
  "$BASE/api/mobile/properties/$PID"

# KB save (expect {"success":true}; on the web KB editor the fields now show these values)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"monthly_rent":"$1500","pet_allowed":"yes","pet_deposit":"$300","preferred_language":"Spanish"}' \
  "$BASE/api/mobile/properties/$PID/kb"

# Delete (expect {"success":true}; property gone from web dashboard)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/properties/$PID"
```

- [ ] **Step 7: Commit**

```bash
git add lib/services/properties.js app/api/mobile/properties
git commit -m "feat: mobile property CRUD + KB endpoints"
```

---

### Task 9: Lease endpoints

**Files:**
- Modify: `lib/services/leases.js` (append `listLeases`)
- Create: `app/api/mobile/properties/[id]/leases/route.js`
- Create: `app/api/mobile/leases/[id]/route.js`

**Interfaces:**
- Consumes: Task 2 service functions; `requireUserId`, `serviceResponse`.
- Produces: `listLeases(userId, propertyId)` → `{ leases }` | `{ error }` (rows ordered by `lease_end` ascending, statuses freshly recomputed). Routes: `GET|POST /api/mobile/properties/:id/leases`, `DELETE /api/mobile/leases/:id`.

- [ ] **Step 1: Append `listLeases` to `lib/services/leases.js`**

```js
// Leases for one property, statuses refreshed first so badges are always
// current (mirrors what the web property page does via refreshLeaseStatuses).
export async function listLeases(userId, propertyId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  await refreshLeaseStatuses(userId, propertyId);

  const { data: leases, error } = await supabase
    .from("leases")
    .select("*")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("lease_end", { ascending: true });
  if (error) return { error: error.message };

  return { leases: leases || [] };
}
```

- [ ] **Step 2: Create `app/api/mobile/properties/[id]/leases/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { listLeases, createLease } from "@/lib/services/leases";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await listLeases(userId, id));
}

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await createLease(userId, id, body));
}
```

- [ ] **Step 3: Create `app/api/mobile/leases/[id]/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { removeLease } from "@/lib/services/leases";

export async function DELETE(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;

  const result = await removeLease(userId, id);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true }); // propertyId is internal — don't expose
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 5: Verify with curl**

Using a real property id as `$PID`:

```bash
# Add (expect {"success":true})
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenant_name":"Curl Tenant","tenant_email":"curl@test.com","unit_number":"2B","monthly_rent":"1450","lease_start":"2026-01-01","lease_end":"2026-08-15"}' \
  "$BASE/api/mobile/properties/$PID/leases"

# Missing name (expect 400 {"error":"Tenant name is required."})
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenant_name":""}' "$BASE/api/mobile/properties/$PID/leases" | head -1

# List (expect the lease above with status "expiring_soon" — end date is within 90 days of 2026-07-04)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/properties/$PID/leases" | python3 -m json.tool

# Foreign property (expect 404)
curl -si -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/mobile/properties/00000000-0000-0000-0000-000000000000/leases" | head -1

# Delete (grab the lease "id" from the list output; expect {"success":true})
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/leases/<lease-id>"
```

Cross-check: the web property page shows/loses the same lease.

- [ ] **Step 6: Commit**

```bash
git add lib/services/leases.js app/api/mobile/properties app/api/mobile/leases
git commit -m "feat: mobile lease endpoints"
```

---

### Task 10: Maintenance endpoints

**Files:**
- Modify: `lib/services/maintenance.js` (append `listRequests`)
- Create: `app/api/mobile/properties/[id]/requests/route.js`
- Create: `app/api/mobile/requests/[id]/route.js`

**Interfaces:**
- Consumes: Task 3 service functions; `requireUserId`, `serviceResponse`; `currentUser` from `@clerk/nextjs/server`.
- Produces: `listRequests(userId, propertyId)` → `{ requests }` | `{ error }` (newest first). Routes: `GET|POST /api/mobile/properties/:id/requests`, `PATCH|DELETE /api/mobile/requests/:id`.

- [ ] **Step 1: Append `listRequests` to `lib/services/maintenance.js`**

```js
export async function listRequests(userId, propertyId) {
  if (!userId) return { error: "You must be signed in." };
  const supabase = getSupabase();
  if (!supabase) return { error: "The database isn't configured." };

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!property) return { error: "Property not found." };

  const { data: requests, error } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("property_id", propertyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };

  return { requests: requests || [] };
}
```

- [ ] **Step 2: Create `app/api/mobile/properties/[id]/requests/route.js`**

```js
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { listRequests, createRequest } from "@/lib/services/maintenance";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  return serviceResponse(await listRequests(userId, id));
}

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Same best-effort email side effect as the web action.
  let landlordEmail = null;
  try {
    const user = await currentUser();
    landlordEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  } catch (e) {
    console.error("maintenance email failed:", e.message);
  }

  return serviceResponse(
    await createRequest(
      userId,
      id,
      { title: body.title, description: body.description, urgency: body.urgency },
      { landlordEmail }
    )
  );
}
```

- [ ] **Step 3: Create `app/api/mobile/requests/[id]/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { updateRequestStatus, removeRequest } from "@/lib/services/maintenance";

export async function PATCH(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await updateRequestStatus(userId, id, body.status);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true }); // propertyId is internal — don't expose
}

export async function DELETE(_request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;

  const result = await removeRequest(userId, id);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ success: true });
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 5: Verify with curl**

```bash
# Add (expect {"success":true}; landlord notification email arrives if Resend configured)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Broken buzzer","description":"Front door buzzer dead","urgency":"urgent"}' \
  "$BASE/api/mobile/properties/$PID/requests"

# List (expect the request, status "open", urgency "urgent"; note its id as RID)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/properties/$PID/requests" | python3 -m json.tool

# Status update (expect {"success":true})
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}' "$BASE/api/mobile/requests/$RID"

# Invalid status (expect 400 {"error":"Invalid status."})
curl -si -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done"}' "$BASE/api/mobile/requests/$RID" | head -1

# Delete (expect {"success":true})
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/requests/$RID"
```

Cross-check on the web Dispatch section: same request appears/updates/disappears.

- [ ] **Step 6: Commit**

```bash
git add lib/services/maintenance.js app/api/mobile/properties app/api/mobile/requests
git commit -m "feat: mobile maintenance endpoints"
```

---

### Task 11: Tenant chat endpoints

**Files:**
- Create: `app/api/mobile/properties/[id]/chat/start/route.js`
- Create: `app/api/mobile/properties/[id]/chat/send/route.js`

**Interfaces:**
- Consumes: `startTenantChat`, `sendChat` from `@/lib/services/chat` (Task 4); `requireUserId`, `serviceResponse`.
- Produces: `POST .../chat/start` body `{ email }` → `{ chatId, greeting, lease }` | `{ noLease: true }` | error. `POST .../chat/send` body `{ chatId, content }` → `{ reply }` | error.

- [ ] **Step 1: Create `app/api/mobile/properties/[id]/chat/start/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { startTenantChat } from "@/lib/services/chat";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return serviceResponse(await startTenantChat(userId, id, body.email));
}
```

- [ ] **Step 2: Create `app/api/mobile/properties/[id]/chat/send/route.js`**

```js
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { sendChat } from "@/lib/services/chat";

export async function POST(request, { params }) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await sendChat(userId, id, body.chatId, body.content);
  if (result.error) return serviceResponse(result);
  return serviceResponse({ reply: result.reply }); // `logged` is internal — don't expose
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Verify with curl**

Use a property (`$PID`) that has an agent and a lease with a known `tenant_email`:

```bash
# Start (expect {"chatId":"...","greeting":"...","lease":{...}}; note chatId as CID)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"curl@test.com"}' "$BASE/api/mobile/properties/$PID/chat/start" | python3 -m json.tool

# Unknown email (expect 200 {"noLease":true})
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"stranger@nowhere.com"}' "$BASE/api/mobile/properties/$PID/chat/start"

# Bad email (expect 400 {"error":"Please enter a valid email address."})
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}' "$BASE/api/mobile/properties/$PID/chat/start" | head -1

# Send (expect {"reply":"..."} answering from the lease context)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"chatId\":\"$CID\",\"content\":\"When does my lease end?\"}" \
  "$BASE/api/mobile/properties/$PID/chat/send"
```

Then check the web Conversations log for that property: the "When does my lease end?" exchange appears; the priming/greeting exchange does NOT.

- [ ] **Step 5: Commit**

```bash
git add app/api/mobile/properties
git commit -m "feat: mobile tenant chat endpoints"
```

---

### Task 12: Billing endpoints

**Files:**
- Create: `app/api/mobile/billing/route.js`
- Create: `app/api/mobile/billing/checkout/route.js`

**Interfaces:**
- Consumes: `getSubscription`, `getUnitCount`, `isActive` from `@/lib/subscription`; `createCheckoutSession` from `@/lib/services/billing` (Task 5); `requireUserId`, `serviceResponse`; `currentUser`.
- Produces: `GET /api/mobile/billing` → `{ plan, status, active, units, billedUnits }`. `POST /api/mobile/billing/checkout` body `{ planKey }` → `{ url }` | error.

- [ ] **Step 1: Create `app/api/mobile/billing/route.js`**

```js
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/mobile-api";
import { getSubscription, getUnitCount, isActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const [units, sub] = await Promise.all([getUnitCount(userId), getSubscription(userId)]);
  return NextResponse.json({
    plan: sub?.plan || null,
    status: sub?.status || null,
    active: isActive(sub),
    units,
    billedUnits: Math.max(1, units),
  });
}
```

- [ ] **Step 2: Create `app/api/mobile/billing/checkout/route.js`**

```js
import { currentUser } from "@clerk/nextjs/server";
import { requireUserId, serviceResponse } from "@/lib/mobile-api";
import { createCheckoutSession } from "@/lib/services/billing";

export async function POST(request) {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const body = await request.json().catch(() => ({}));

  // v1: reuse the web success/cancel URLs — the mobile in-app browser shows the
  // web confirmation page (deep-link return is Phase 9 polish, per design doc).
  const host = request.headers.get("host");
  const proto = host && host.includes("localhost") ? "http" : "https";
  const baseUrl = host ? `${proto}://${host}` : "http://localhost:3000";

  let email;
  try {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
  } catch (e) {
    console.error("checkout email lookup failed:", e.message);
  }

  return serviceResponse(await createCheckoutSession(userId, body.planKey, { baseUrl, email }));
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Verify with curl**

```bash
# Plan view (expect plan/status/active/units/billedUnits; matches web /dashboard/billing)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/mobile/billing" | python3 -m json.tool

# Checkout (expect {"url":"https://checkout.stripe.com/..."}; open it — right plan, quantity = billedUnits)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"planKey":"dispatch"}' "$BASE/api/mobile/billing/checkout"

# Unknown plan (expect 400 {"error":"Unknown plan."})
curl -si -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"planKey":"platinum"}' "$BASE/api/mobile/billing/checkout" | head -1
```

- [ ] **Step 5: Commit**

```bash
git add app/api/mobile/billing
git commit -m "feat: mobile billing endpoints"
```

---

### Task 13: Full verification sweep + diff audit

**Files:** none created/modified — verification only.

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: no errors; all 12 `/api/mobile/*` route files listed.

- [ ] **Step 2: Full web smoke pass (every delegated flow, one sitting)**

With `npm run dev`, signed in:
1. Marketing pages (/, /features, /pricing, /about, /demo) load; waitlist form on /demo still submits.
2. Dashboard: stats correct, property list correct, add property works.
3. Property detail: edit, KB save (agent syncs), delete (redirects to /dashboard).
4. Leases: add (badge correct), delete.
5. Dispatch: add (email arrives), status change, delete.
6. Chat: tenant email happy path, unknown-email path, exchanges logged, priming absent from log.
7. Billing: plan cards, checkout opens, cancel banner.
8. Tenant portal (/tenant): lookup + request submission still work (untouched code — regression check only).

- [ ] **Step 3: Diff audit — confirm nothing out of bounds changed**

```bash
git diff --stat $(git log --format=%H --grep="checkpoint before mobile app build" -n 1)
```
Expected: ONLY these paths appear — `app/dashboard/actions.js`, `app/dashboard/[id]/actions.js`, `app/dashboard/billing/actions.js`, `middleware.js`, `lib/mobile-api.js`, `lib/services/*`, `app/api/mobile/*`, `docs/superpowers/*`. Any other file in the diff is a Rule 1 violation — investigate and revert it.

- [ ] **Step 4: Re-run the 401 sweep**

```bash
for p in dashboard properties/x billing "properties/x/leases"; do
  curl -s -o /dev/null -w "%{http_code} /api/mobile/$p\n" "$BASE/api/mobile/$p"
done
```
Expected: `401` for every line.

- [ ] **Step 5: Commit any doc updates and report**

If the smoke pass surfaced fixes, they were committed under their task. Report results to the developer with the checklist above marked pass/fail. Phase 1 is then complete; Phase 2 (Expo scaffold + auth) starts as a NEW project in `Atlas_Mobile/` per spec Section 3.5 — nothing more is added to this repo for it.
