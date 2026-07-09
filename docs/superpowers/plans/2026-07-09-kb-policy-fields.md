# Atlas Website — KB Policy Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six optional policy fields to the KB editor, persist them in `kb_data` without wiping on cross-surface saves, push them into the Retell knowledge document, and make the agent answer multi-part questions part-by-part (escalating only the parts it lacks).

**Architecture:** Two files in the live-production `Atlas_Website` repo on branch `kb-policy-fields`. `lib/services/properties.js` gets the merge fix in `saveKnowledgeBase` (only overwrite fields present in the submitted input), six new lines in `composeKbText`, and a rewritten escalation section in `composeSystemPrompt`. `components/KnowledgeBaseEditor.js` gets six new `<textarea>` fields. No DB migration — `kb_data` is JSONB.

**Tech Stack:** Next.js 15 (JS), React Server Actions, Supabase (JSONB `kb_data`), Retell REST (via `lib/retell.js`). No test framework.

## Global Constraints

- ONE repo: `/Users/akhil/Technology/Atlas/Atlas_Website`, branch `kb-policy-fields`. This is **LIVE PRODUCTION** (deploys on push to `main`). Changes are strictly ADDITIVE — the ONLY files touched are `lib/services/properties.js` and `components/KnowledgeBaseEditor.js`. Plain commit messages, NO `Co-Authored-By` / AI-attribution trailers. Do NOT merge or push to `main` — the developer merges after a browser smoke (Rule 1).
- **No DB migration.** `kb_data` is a JSONB column; new keys need no schema change.
- **The six new `kb_data` keys, exact:** `guest_policy`, `lease_renewal_policy`, `subletting_policy`, `break_lease_policy`, `move_out_process`, `emergency_instructions`. All optional free text.
- **Merge semantics (the safety fix):** `saveKnowledgeBase` must write a KB field ONLY when its key is present in `input`, merging over the property's existing `kb_data`. `pet_allowed` (a yes/no select) is recomputed only when present in `input`. The hidden `id` form field is never copied into `kb_data`. This preserves exact web behavior (the web form submits every field, blank = `""`, so it can still clear a field) while preventing a save that omits a field (e.g. the mobile card) from clearing it.
- **Trust boundary unchanged:** `userId` from Clerk only; the property-ownership check (`.eq("user_id", userId)`) stays.
- Gate per task: `npm run build` succeeds (no test framework in this repo — do not add one). 
- Run every command from the repo root: `cd /Users/akhil/Technology/Atlas/Atlas_Website` first (shell CWD does not persist between commands).

---

### Task 1: Service — merge fix, KB doc, and system prompt (`lib/services/properties.js`)

**Files:**
- Modify: `lib/services/properties.js` (`saveKnowledgeBase`, `composeKbText`, `composeSystemPrompt`)

**Interfaces:**
- Consumes: `str()` helper (already in the file); `input` object (form fields, or the mobile JSON body); `property.kb_data` (existing JSONB, may be null).
- Produces: `kb_data` now carries the six new keys; the Retell knowledge doc and system prompt include them.

- [ ] **Step 1: Rewrite `saveKnowledgeBase` field-building to fetch-first + merge**

In `lib/services/properties.js`, the current body of `saveKnowledgeBase` builds `const kb = { ... }` from a fixed whitelist BEFORE fetching the property. Replace that whole sequence — the `const kb = {...};` block (the 11 `str(input.x)` lines) AND the property `select` that follows it — so the property is fetched first and `kb` is merged over `property.kb_data`. Replace this exact span:

```js
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
```

with:

```js
  // Fetch the property first so we can merge over its existing kb_data.
  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !property) return { error: "Property not found." };

  // The text KB fields this form manages. A field is written ONLY when its key
  // is present in `input`, so a save that omits a field (e.g. the mobile card,
  // which doesn't submit the newer policy fields) preserves the stored value
  // instead of clearing it. `pet_allowed` (a yes/no select) is handled below.
  const KB_TEXT_FIELDS = [
    "monthly_rent",
    "late_fee",
    "grace_period",
    "pet_deposit",
    "pet_monthly_fee",
    "maintenance_contact",
    "office_hours",
    "parking_policy",
    "custom_notes",
    "preferred_language",
    "guest_policy",
    "lease_renewal_policy",
    "subletting_policy",
    "break_lease_policy",
    "move_out_process",
    "emergency_instructions",
  ];

  const kb = { ...(property.kb_data || {}) };
  for (const field of KB_TEXT_FIELDS) {
    if (field in input) kb[field] = str(input[field]);
  }
  if ("pet_allowed" in input) {
    kb.pet_allowed = str(input.pet_allowed) === "yes" ? "yes" : "no";
  }
```

(The `.update({ kb_data: kb })` call and everything after it stay exactly as they are.)

- [ ] **Step 2: Add the six fields to `composeKbText`**

In `composeKbText`, immediately AFTER the existing `custom_notes` line and BEFORE `return lines.join("\n");`, insert:

```js
  if (kb.guest_policy) lines.push(`Guest policy: ${kb.guest_policy}`);
  if (kb.lease_renewal_policy) lines.push(`Lease renewal policy: ${kb.lease_renewal_policy}`);
  if (kb.subletting_policy) lines.push(`Subletting policy: ${kb.subletting_policy}`);
  if (kb.break_lease_policy) lines.push(`Break-lease / early termination policy: ${kb.break_lease_policy}`);
  if (kb.move_out_process) lines.push(`Move-out and deposit return process: ${kb.move_out_process}`);
  if (kb.emergency_instructions) lines.push(`Emergency instructions: ${kb.emergency_instructions}`);
```

So the tail of the function reads: `… if (kb.custom_notes) lines.push(...)` then the six new lines, then `return lines.join("\n");`.

- [ ] **Step 3: Rewrite the escalation section of `composeSystemPrompt`**

In `composeSystemPrompt`, replace the single escalation line:

```js
    `- If you don't know the answer, or it isn't in the knowledge base or the tenant's lease details, reply exactly: "I'll flag this for your property manager." and escalate the question to a human.`,
```

with these three lines (multi-part answering, per-part escalation, emergency-first):

```js
    "- If a tenant asks about several things at once, answer each part you have information for, and only escalate the specific parts you don't. Never refuse the whole question because one part is missing.",
    `- For any part you cannot answer from the knowledge base or the tenant's lease details, tell the tenant you'll flag that specific part for the property manager (for example: "For the pet deposit, I'll flag this for your property manager."). Do not guess.`,
    "- If the tenant describes an urgent safety emergency (fire, flood, lockout, or similar) and the knowledge base includes emergency instructions, give those instructions first and clearly, before anything else.",
```

(The other lines of the prompt — the intro, the KB-only rule, the lease-details rule, tone, language — stay exactly as they are.)

- [ ] **Step 4: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: build succeeds (compiles with no errors). The KB service is server-only; a syntax or reference error here fails the build.

- [ ] **Step 5: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add lib/services/properties.js
git commit -m "feat: KB policy fields in agent knowledge + prompt, merge-safe save"
```

---

### Task 2: Editor — six new textareas (`components/KnowledgeBaseEditor.js`)

**Files:**
- Modify: `components/KnowledgeBaseEditor.js`

**Interfaces:**
- Consumes: the existing `input` / `label` class constants and the `kb` object (`initial` prop). The `name` of each new field must exactly match its `kb_data` key so `Object.fromEntries(formData)` carries it to the service.

- [ ] **Step 1: Add the Emergency instructions field after the Contact & hours grid**

In `components/KnowledgeBaseEditor.js`, immediately AFTER the "Contact & hours" `<div className="grid gap-4 sm:grid-cols-2"> … </div>` block (the one containing `maintenance_contact` and `office_hours`) and BEFORE the Parking policy `<div>`, insert:

```jsx
      {/* Emergency instructions */}
      <div>
        <label className={label}>Emergency instructions</label>
        <textarea
          name="emergency_instructions"
          rows={3}
          defaultValue={kb.emergency_instructions}
          placeholder="What a tenant should do right now in a flood, fire, or lockout — e.g. shut off the main water valve under the kitchen sink; call 911 for fire; after-hours lockouts call (555) 555-0199…"
          className={input}
        />
        <p className="mt-1 text-xs text-navy/45">
          What a tenant should do right now in a flood, fire, or lockout. Your agent leads with this in an emergency.
        </p>
      </div>
```

- [ ] **Step 2: Add the "Lease & tenancy policies" group after Parking policy**

Immediately AFTER the Parking policy `<div>` (the one with `name="parking_policy"`) and BEFORE the Custom notes `<div>`, insert:

```jsx
      {/* Lease & tenancy policies */}
      <div className="rounded-2xl border border-navy/10 bg-cream/60 p-5">
        <p className="mb-3 text-sm font-semibold text-navy">Lease &amp; tenancy policies</p>
        <div className="space-y-4">
          <div>
            <label className={label}>Guest policy</label>
            <textarea
              name="guest_policy"
              rows={2}
              defaultValue={kb.guest_policy}
              placeholder="Overnight guests up to 14 nights per quarter; longer stays need written approval…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Lease renewal policy</label>
            <textarea
              name="lease_renewal_policy"
              rows={2}
              defaultValue={kb.lease_renewal_policy}
              placeholder="Renewal offers go out 90 days before lease end; rent may adjust to market…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Subletting policy</label>
            <textarea
              name="subletting_policy"
              rows={2}
              defaultValue={kb.subletting_policy}
              placeholder="Subletting requires written landlord approval and a screened subtenant…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Break-lease / early termination policy</label>
            <textarea
              name="break_lease_policy"
              rows={2}
              defaultValue={kb.break_lease_policy}
              placeholder="Two months' rent as an early-termination fee with 60 days' written notice…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Move-out &amp; deposit return process</label>
            <textarea
              name="move_out_process"
              rows={2}
              defaultValue={kb.move_out_process}
              placeholder="Schedule a move-out inspection; deposit returned within 21 days minus documented damages…"
              className={input}
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: build succeeds. (JSX must be well-formed; unescaped `&` in visible text uses `&amp;` as shown, matching the file's existing `tenant&apos;s` style.)

- [ ] **Step 4: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add components/KnowledgeBaseEditor.js
git commit -m "feat: six policy fields in the Knowledge Base editor"
```

---

### Task 3: Build gate + merge-safety curl + developer browser smoke (developer-run)

**Files:** none (verification only). The implementer does NOT run the browser smoke or the merge/deploy — present these steps to the developer.

- [ ] **Step 1: Production build**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
npm run build
```
Expected: succeeds with no errors.

- [ ] **Step 2: Merge-safety curl (the whole point of the merge fix)**

With the app running (`npm run dev`) and a valid Clerk token + a real property `id` that already has some policy fields saved:
1. Save the KB from the web editor with the six policy fields filled (do this in the browser first — Step 3.2).
2. Then POST a PARTIAL body to the mobile KB endpoint (simulating a mobile save that omits the policy fields):
```bash
curl -X POST "http://localhost:3000/api/mobile/properties/<PROPERTY_ID>/kb" \
  -H "Authorization: Bearer <CLERK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"monthly_rent":"$1850"}'
```
Expected: `{"success":true}`; then confirm in Supabase (or by reopening the web editor) that the six policy fields are **still present** (NOT wiped) and `monthly_rent` updated. This proves the merge fix.

- [ ] **Step 3: Browser smoke**

1. Open a property's KB editor → the six new fields render in the existing style; saved values load.
2. Fill several fields including Emergency instructions → Save → "✓ Saved — your agent now knows this."; reopen the page → values persisted.
3. In the property's agent chat, ask a **multi-part** question mixing a known and an unknown field (e.g. "What's the guest policy, and what color is the roof?") → the agent answers the guest-policy part and flags ONLY the unknown part for the property manager (not the whole answer).
4. Ask an emergency question ("there's water flooding my unit right now") → the agent leads with the emergency instructions.
5. Confirm existing KB fields, the dashboard, and property pages are unaffected.

- [ ] **Step 4: Merge + deploy**

On a passing smoke, use `superpowers:finishing-a-development-branch` to merge `kb-policy-fields` → `main` and `git push origin main` (Vercel deploys the change to production).

---

## Notes for the executor

- Tasks 1 and 2 are independent files and can be reviewed separately; Task 1 (the service) is the substance — the merge fix and the composers are what make the fields reach the agent, so review it closely against the Global Constraints' merge semantics.
- Do NOT add unit tests or a test runner — this repo has none; the gate is `npm run build` plus the developer smoke. (If you feel the merge logic deserves a test, note it as a concern rather than adding a framework.)
- The six `name` attributes in the editor MUST exactly match the six `kb_data` keys and the `composeKbText` reads; a mismatch silently drops a field. Cross-check the keys in both files before committing.
- Emergency instructions is placed by the Contact & hours block (operational/safety), the five lease policies are grouped in one box — this grouping is developer-approved; keep it.
