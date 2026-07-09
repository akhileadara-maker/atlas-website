# Atlas Website — Knowledge Base Policy Fields — Design

**Date:** 2026-07-09
**Status:** Approved by developer (six new KB fields; system-prompt partial-escalation rewrite; the merge fix to prevent cross-surface field wipes — all approved)
**Repo:** `Atlas_Website` (LIVE PRODUCTION — deploys to Vercel on push to `main`). This is a **Rule-1** change: feature branch `kb-policy-fields`; `npm run build` + curl + developer browser smoke; merge + push (deploy) only after the smoke passes.
**Baseline:** `Atlas_Website` `main` at `9cf5647`.

## Goal

Add six new optional Knowledge Base fields to the landlord's KB editor, persist them in `kb_data`, push them into the per-property Retell agent's knowledge document, and update the agent's system prompt so it answers every part of a multi-part question it has information for — escalating only the specific parts it genuinely lacks, not the whole answer.

## The six new fields (all optional, free text)

| Field label | `kb_data` key | Input |
|---|---|---|
| Guest policy | `guest_policy` | textarea |
| Lease renewal policy | `lease_renewal_policy` | textarea |
| Subletting policy | `subletting_policy` | textarea |
| Break-lease / early termination policy | `break_lease_policy` | textarea |
| Move-out & deposit return process | `move_out_process` | textarea |
| Emergency instructions (what to do right now in a flood, fire, or lockout) | `emergency_instructions` | textarea |

All are policy/process prose, so they use `<textarea>` (like the existing `custom_notes`), not single-line inputs, with the existing `input` / `label` Tailwind classes. No `placeholder`-vs-real distinction — same visual treatment as existing fields.

## Schema — NO migration

`kb_data` is a **JSONB column** on `properties`. `saveKnowledgeBase` builds a plain object and writes `.update({ kb_data: kb })`; the column already accepts arbitrary JSON. Adding fields requires **no DB migration** — only adding the keys to the editor, the save whitelist, and the composer.

## Changes (Atlas_Website only — 2 files)

### 1. `components/KnowledgeBaseEditor.js`
Add the six `<textarea>` fields, each `name`d with its `kb_data` key, `defaultValue={kb.<key>}`, styled with the existing `input` class + a `label`. Group them under a labeled section heading (a `<p className="mb-3 text-sm font-semibold text-navy">` like the Pet-policy box) so the editor stays scannable — proposed grouping:
- A **"Lease & tenancy policies"** group: Guest policy, Lease renewal policy, Subletting policy, Break-lease / early termination policy, Move-out & deposit return process.
- **Emergency instructions** placed near the maintenance emergency contact (operational, safety-relevant), with helper text noting it is what a tenant should do *right now* in a flood, fire, or lockout.
No change to the submit button, status messages, or existing fields.

### 2. `lib/services/properties.js` — three edits

**a. The merge fix in `saveKnowledgeBase` (approved).** Today the function rebuilds `kb` from scratch from a fixed whitelist, defaulting any missing field to `""`. Because the **mobile** KB endpoint (`POST /api/mobile/properties/[id]/kb`) writes through this **same** service with only the fields the mobile card knows, a mobile save would wipe the six new web-only fields. Fix: fetch the property first (it already `select("*")`s, so `kb_data` is in hand), then build `kb` by **merging over the existing `kb_data`, overwriting only the keys actually present in `input`**:
- A field is written only when its key is present in `input` (`"field" in input`), so the web editor (which submits all its fields, blank = `""`) keeps its exact behavior — including clearing a field — while a save from a surface that omits a field preserves the stored value.
- `pet_allowed` (a yes/no select) is likewise only recomputed when present in `input`.
- The hidden `id` form field is never copied into `kb_data` (it is not a KB field).
This is a strict-superset safety change: no existing web behavior changes; cross-surface wipes are prevented.

**b. `composeKbText(property, kb)`** — append six `if (kb.<key>) lines.push(...)` lines so each provided field becomes a labeled line in the plain-text knowledge document pushed to the Retell KB (e.g. `Guest policy: …`, `Emergency instructions: …`). Placed after the existing lines, matching the current conditional-push style.

**c. `composeSystemPrompt(propertyName, language)`** — replace the single all-or-nothing escalation rule with granular, multi-part behavior:
- Keep: answer general questions only from the knowledge base; use the tenant's provided lease details for personal questions; never guess.
- New: *"If a tenant asks about several things at once, answer each part you have information for, and only escalate the specific parts you don't — never refuse the whole question because one part is missing."*
- New (replaces the exact-string rule): *"For any part you cannot answer from the knowledge base or the tenant's lease details, tell the tenant you'll flag that specific part for the property manager (for example: 'For the pet deposit, I'll flag this for your property manager.'). Do not guess."*
- New (emergency): *"If the tenant describes an urgent safety emergency (fire, flood, lockout, or similar) and the knowledge base has emergency instructions, give those instructions first and clearly, before anything else."*

## Data flow (unchanged shape)

Editor form → `saveKnowledgeBase` action → `saveKnowledgeBaseService(userId, id, Object.fromEntries(formData))` → merge into `kb_data` (persisted) → when the property has a Retell agent: `updateKnowledgeBaseContent(kbId, title, composeKbText(...))` + `updateAgentSystemPrompt(agentId, composeSystemPrompt(...))` + `updateAgentLanguage(...)`. All best-effort inside the existing try/catch; on Retell failure the save still persists and returns the existing "Saved your info, but updating the AI agent failed" message. Trust boundary (`userId` from Clerk only) and the property-ownership check are unchanged.

## Error handling

- No new failure modes. The six fields are optional; empty ones are simply omitted from the knowledge document (existing `if (kb.x)` pattern).
- The merge fix cannot lose data: a field absent from `input` is preserved, not cleared.
- Retell push remains best-effort with the existing error surface.

## Testing / exit criteria

**Gate (repo convention — no test framework):** `npm run build` succeeds on the branch.

**curl (against the running dev server or preview):** `POST /api/mobile/properties/:id/kb` with a body containing ONLY a subset (e.g. just `monthly_rent`) and confirm the six policy fields already stored are NOT wiped (the merge fix) — the row in Supabase retains them.

**Developer browser smoke (before merge/deploy):**
1. Open a property's KB editor → the six new fields render in the existing style and load any saved values.
2. Fill several (incl. Emergency instructions) → Save → success message; reopen → values persisted.
3. Ask the property's agent a **multi-part** question mixing a known field and an unknown one (e.g. "What's the guest policy and what's the roof color?") → the agent answers the guest-policy part and flags only the unknown part for the property manager (not the whole thing).
4. Ask an emergency question ("there's water flooding my unit right now") → the agent leads with the emergency instructions.
5. Confirm no regression to existing KB fields, the dashboard, or property pages.

THEN merge `kb-policy-fields` → `main` and push (Vercel deploys).

## Out of scope (later)

- The **mobile** KnowledgeBaseCard showing/editing these six fields (mobile is parked; the merge fix already protects the fields from mobile saves in the meantime). A future mobile phase can add them to the card.
- Any change to how Retell stores/uses the knowledge document beyond the existing `updateKnowledgeBaseContent` mechanism.
- Structured/validated inputs for the policies (they are free text by design).
