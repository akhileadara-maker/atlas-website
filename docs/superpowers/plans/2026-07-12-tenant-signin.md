# Atlas Website — Verified Tenant Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A verified tenant flow — unified `/signin` front door (landlord Clerk modal unchanged / tenant email+OTP), signed 30-day tenant session, lease routing, and a tenant home with the first web tenant chat (hidden priming unchanged), lease card, and maintenance form — retiring the unverified email-lookup paths.

**Architecture:** Six tasks on branch `tenant-signin` in the live-prod `Atlas_Website` repo. Foundations first (migration file + session lib), then the OTP service, then tenant-scoped chat services, then the `/signin` front door (+ navbar), then the rebuilt `/tenant` (page/actions/TenantHome, deleting TenantPortal), then the developer verification/deploy task. Approved design: `docs/superpowers/specs/2026-07-12-tenant-signin-design.md`.

**Tech Stack:** Next.js 15 App Router (JS), Server Actions, Clerk (landlord only, untouched), Supabase (service-role, RLS-on-no-policies), Resend (`sendEmail`), Node `crypto` (zero new dependencies), Retell via the existing `lib/retell.js`.

## Global Constraints

- ONE repo: `/Users/akhil/Technology/Atlas/Atlas_Website`, branch `tenant-signin`. **LIVE PRODUCTION** — do NOT merge or push to `main` (the developer does, after the smoke). Plain commit messages — a plain subject line only, with NO attribution trailer of any kind. Nothing under `.superpowers/` committed. Do NOT commit the developer's local `.gitignore` working-tree edit (leave it unstaged).
- Files touched, exhaustive: CREATE `supabase/migrations/0013_tenant_verification.sql`, `lib/tenantSession.js`, `lib/services/tenantAuth.js`, `app/signin/actions.js`, `app/signin/page.js`, `components/TenantSignIn.js`, `components/TenantHome.js`. MODIFY `lib/services/chat.js` (additive only), `app/tenant/actions.js`, `app/tenant/page.js`, `components/Navbar.js` (Log-in block only). DELETE `components/TenantPortal.js` (Task 5 only, after nothing imports it).
- ZERO new npm dependencies. Node `crypto` only for hashing/signing.
- **Untouchable:** `composeTenantContext` and the landlord-scoped `startChatSession`/`sendChat`/`startTenantChat` in `lib/services/chat.js`; `components/ChatWidget.js`; everything under `app/dashboard/`; `middleware.js`; all mobile API routes.
- **Security invariants (binding, from the spec):** tenant identity ONLY from `readTenantSession()`; OTP codes stored as sha256 hashes; 10-min expiry; 5-attempt cap; re-request replaces; neutral request-code response (a code is sent to any well-formed email — lease existence is only revealed after a correct code); constant-time signature compare; cookie `atlas_tenant_session` httpOnly + sameSite=lax + secure-in-production + 30d; no secrets client-side; priming never shown/logged.
- Exact user-facing strings (use verbatim): neutral confirmation `If that email is on a lease, a code is on its way.`; errors `Please enter a valid email address.` / `Tenant sign-in isn't configured yet.` / `We couldn't send a code right now — try again in a moment.` / `That code has expired — request a new one.` / `Too many attempts — request a new code.` / `That code doesn't match.`; no-lease card `We couldn't find a lease for that email — contact your property manager.`
- Style: existing tokens/classes only — field `w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal`, label `mb-1 block text-sm font-medium text-navy/70`, teal button `inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60`, card `rounded-3xl border border-navy/10 bg-white p-7`. Playfair via `font-serif`. Errors in `text-coral`.
- Gate per task: `npm run build` succeeds. No test framework in this repo — do NOT add one.
- Run every command from the repo root: `cd /Users/akhil/Technology/Atlas/Atlas_Website` first (shell CWD does not persist).
- Env var (developer sets at deploy): `TENANT_SESSION_SECRET`. Code must degrade gracefully when unset (config-error messages, never a crash).

---

### Task 1: Foundations — migration 0013 + `lib/tenantSession.js`

**Files:**
- Create: `supabase/migrations/0013_tenant_verification.sql`
- Create: `lib/tenantSession.js`

**Interfaces:**
- Produces (consumed by Tasks 2, 4, 5): `mintTenantSession(email) -> string`, `readTenantSession() -> Promise<{ email } | null>`, `setTenantSessionCookie(value) -> Promise<void>`, `clearTenantSessionCookie() -> Promise<void>`, `isTenantSessionConfigured() -> boolean`. The `tenant_otps` table schema Task 2 assumes; `conversations.tenant_email` Task 3 writes.

- [ ] **Step 1: Create `supabase/migrations/0013_tenant_verification.sql`**

```sql
-- Tenant verification (run by hand in the Supabase SQL editor).
-- 1) One-time sign-in codes. One row per email; re-requesting a code replaces
--    the row (upsert). Codes are stored as sha256 hashes, never plaintext.
create table if not exists public.tenant_otps (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tenant_otps enable row level security;
-- No policies: anon/authenticated denied; the server-side service-role key
-- bypasses RLS. Same posture as every other table.

-- 2) Tenant identity on logged conversations (verified tenant chats only;
--    the landlord test console leaves this null). Enables the future
--    per-tenant inbox grouping.
alter table public.conversations add column if not exists tenant_email text;
```

- [ ] **Step 2: Create `lib/tenantSession.js`**

```js
import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

// The app's first non-Clerk session: a stateless HMAC-signed cookie holding
// only the tenant's verified email + an expiry. No server-side session store
// (v1) — sign-out clears the cookie, the 30-day expiry bounds the rest.
// Requires TENANT_SESSION_SECRET (server-only; generate: openssl rand -hex 32).

const COOKIE_NAME = "atlas_tenant_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isTenantSessionConfigured() {
  return Boolean(process.env.TENANT_SESSION_SECRET);
}

const sign = (payload) =>
  crypto
    .createHmac("sha256", process.env.TENANT_SESSION_SECRET)
    .update(payload)
    .digest("base64url");

// Signed session value: base64url(JSON{email, exp}).signature
export function mintTenantSession(email) {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + MAX_AGE_SECONDS * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Verifies signature (constant-time) + expiry. Any failure = no session.
export async function readTenantSession() {
  if (!isTenantSessionConfigured()) return null;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.email || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export async function setTenantSessionCookie(value) {
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearTenantSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
```

- [ ] **Step 3: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: succeeds (the new lib compiles; the migration is not executed by the build).

- [ ] **Step 4: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add supabase/migrations/0013_tenant_verification.sql lib/tenantSession.js
git commit -m "feat: tenant session lib + tenant verification migration"
```

---

### Task 2: OTP service — `lib/services/tenantAuth.js`

**Files:**
- Create: `lib/services/tenantAuth.js`

**Interfaces:**
- Consumes: `getSupabase` (`@/lib/supabase`), `sendEmail`, `isResendConfigured` (`@/lib/resend`), `isTenantSessionConfigured` (`@/lib/tenantSession`), Node `crypto`.
- Produces (consumed by Task 4): `requestTenantCode(email) -> { sent: true, email } | { error }`, `verifyTenantCode(email, code) -> { ok: true, email } | { error }`.

- [ ] **Step 1: Create `lib/services/tenantAuth.js`**

```js
import "server-only";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { isTenantSessionConfigured } from "@/lib/tenantSession";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// Sends a 6-digit one-time code. Anti-enumeration: a code is sent to ANY
// well-formed email — whether it's on a lease is only revealed after a correct
// code. Errors are limited to malformed email / unconfigured services.
export async function requestTenantCode(email) {
  const e = (email || "").toString().trim().toLowerCase();
  if (!isEmail(e)) return { error: "Please enter a valid email address." };
  if (!isTenantSessionConfigured()) return { error: "Tenant sign-in isn't configured yet." };
  if (!isResendConfigured()) {
    return { error: "We couldn't send a code right now — try again in a moment." };
  }
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const { error } = await supabase.from("tenant_otps").upsert(
    {
      email: e,
      code_hash: sha256(code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  if (error) {
    console.error("otp store failed:", error.message);
    return { error: "We couldn't send a code right now — try again in a moment." };
  }

  const { sent } = await sendEmail({
    to: e,
    subject: "Your Atlas sign-in code",
    html: `
      <div style="font-family:Georgia,serif;background:#fafaf8;padding:32px;color:#1a2a41">
        <h2 style="margin:0 0 8px">Your Atlas sign-in code</h2>
        <p style="margin:0 0 20px;color:#4a5568">Enter this code to sign in. It expires in 10 minutes.</p>
        <p style="font-size:36px;letter-spacing:10px;font-weight:bold;margin:0;color:#2a9d8e">${code}</p>
        <p style="margin:24px 0 0;font-size:13px;color:#718096">If you didn't request this, you can ignore this email.</p>
      </div>`,
  });
  if (!sent) return { error: "We couldn't send a code right now — try again in a moment." };

  return { sent: true, email: e };
}

// Verifies a code: expiry, attempt cap (each miss increments; the cap kills
// the code), hash compare. On success the row is deleted (single-use).
export async function verifyTenantCode(email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!isEmail(e) || !/^\d{6}$/.test(c)) return { error: "That code doesn't match." };
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const { data: row } = await supabase
    .from("tenant_otps")
    .select("code_hash, expires_at, attempts")
    .eq("email", e)
    .maybeSingle();
  if (!row) return { error: "That code has expired — request a new one." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "That code has expired — request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { error: "Too many attempts — request a new code." };
  }

  if (sha256(c) !== row.code_hash) {
    await supabase
      .from("tenant_otps")
      .update({ attempts: row.attempts + 1 })
      .eq("email", e);
    return { error: "That code doesn't match." };
  }

  await supabase.from("tenant_otps").delete().eq("email", e);
  return { ok: true, email: e };
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add lib/services/tenantAuth.js
git commit -m "feat: tenant OTP request/verify service"
```

---

### Task 3: Tenant-scoped chat services (additive, `lib/services/chat.js`)

**Files:**
- Modify: `lib/services/chat.js` (APPEND two exported functions; change NOTHING existing — `composeTenantContext`, `startChatSession`, `sendChat`, `startTenantChat` stay byte-identical)

**Interfaces:**
- Consumes: the file's existing imports (`getSupabase`, `startChat`, `sendChatMessage`, `computeLeaseStatus`, `str`) and the private `composeTenantContext`.
- Produces (consumed by Task 5): `startVerifiedTenantChat(email, propertyId) -> { chatId, greeting, lease } | { noLease: true } | { error }`, `sendVerifiedTenantChat(email, propertyId, chatId, content) -> { reply, logged } | { error }`.

- [ ] **Step 1: Append the two functions at the end of `lib/services/chat.js`**

```js
// ---- Verified tenant chat (tenant-session-scoped; Phase: tenant sign-in) ----
// Identity comes from the caller's verified tenant session (never client
// input). The lease row itself supplies the landlord user_id, so ownership
// scoping derives from the data, not from auth().

// Finds the verified tenant's lease at the picked property. Shared by the two
// functions below; the query IS the validation of the property pick.
async function findVerifiedLease(supabase, email, propertyId) {
  const e = str(email).toLowerCase();
  const { data: rows } = await supabase
    .from("leases")
    .select("user_id, property_id, tenant_name, unit_number, lease_start, lease_end, monthly_rent")
    .ilike("tenant_email", e)
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

  const row = await findVerifiedLease(supabase, email, propertyId);
  if (!row) return { error: "Something went wrong — please sign in again." };

  const message = content.trim();
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
```

- [ ] **Step 2: Verify nothing existing changed**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && git diff lib/services/chat.js | grep "^-" | grep -v "^---" ; echo "deletions above (should be none)"`
Expected: no deletion lines — the change is purely appended.

- [ ] **Step 3: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add lib/services/chat.js
git commit -m "feat: verified-tenant chat services with identity-stamped logging"
```

---

### Task 4: The front door — `/signin` (actions + page + TenantSignIn) + Navbar link

**Files:**
- Create: `app/signin/actions.js`
- Create: `components/TenantSignIn.js`
- Create: `app/signin/page.js`
- Modify: `components/Navbar.js` (ONLY the signed-out `SignInButton` block)

**Interfaces:**
- Consumes: Task 2's `requestTenantCode`/`verifyTenantCode`; Task 1's `mintTenantSession`/`setTenantSessionCookie`.
- Produces: `requestCode(prevState, formData)`, `verifyCode(prevState, formData)` server actions; the public `/signin` route Task 5 redirects to.

- [ ] **Step 1: Create `app/signin/actions.js`**

```js
"use server";

import { redirect } from "next/navigation";
import { requestTenantCode, verifyTenantCode } from "@/lib/services/tenantAuth";
import { mintTenantSession, setTenantSessionCookie } from "@/lib/tenantSession";

// Step 1: send a code. Neutral response regardless of lease existence.
export async function requestCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const res = await requestTenantCode(email);
  if (res.error) return { error: res.error };
  return { sent: true, email: res.email };
}

// Step 2: verify the code; on success mint the session and go to /tenant.
export async function verifyCode(prevState, formData) {
  const email = (formData.get("email") || "").toString();
  const code = (formData.get("code") || "").toString();
  const res = await verifyTenantCode(email, code);
  if (res.error) return { error: res.error };

  await setTenantSessionCookie(mintTenantSession(res.email));
  redirect("/tenant"); // throws — must be outside try/catch
}
```

- [ ] **Step 2: Create `components/TenantSignIn.js`**

```jsx
"use client";

import { useActionState } from "react";
import { requestCode, verifyCode } from "@/app/signin/actions";

const field =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";
const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60";

// Two-step tenant sign-in: email -> 6-digit code. The neutral confirmation
// never reveals whether the email is on a lease (anti-enumeration).
export default function TenantSignIn() {
  const [reqState, requestAction, requesting] = useActionState(requestCode, {});
  const [verState, verifyAction, verifying] = useActionState(verifyCode, {});

  // Step 2 — code entry (a code was sent)
  if (reqState?.sent) {
    return (
      <div>
        <p className="text-sm text-navy/60">
          If that email is on a lease, a code is on its way. Enter it below —
          it expires in 10 minutes.
        </p>
        <form action={verifyAction} className="mt-4 space-y-4">
          <input type="hidden" name="email" value={reqState.email} />
          <div>
            <label className={label}>6-digit code</label>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              className={`${field} text-center text-2xl tracking-[0.5em]`}
            />
          </div>
          {verState?.error && <p className="text-sm text-coral">{verState.error}</p>}
          <button type="submit" disabled={verifying} className={`${tealBtn} w-full`}>
            {verifying ? "Verifying…" : "Sign in"}
          </button>
        </form>
        <form action={requestAction} className="mt-3 text-center">
          <input type="hidden" name="email" value={reqState.email} />
          <button type="submit" disabled={requesting} className="text-sm font-medium text-teal hover:text-teal-600">
            {requesting ? "Sending…" : "Resend code"}
          </button>
        </form>
      </div>
    );
  }

  // Step 1 — email entry
  return (
    <form action={requestAction} className="space-y-4">
      <div>
        <label className={label}>Your email</label>
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          className={field}
        />
        <p className="mt-1 text-xs text-navy/45">Use the email your landlord has on file for your lease.</p>
      </div>
      {reqState?.error && <p className="text-sm text-coral">{reqState.error}</p>}
      <button type="submit" disabled={requesting} className={`${tealBtn} w-full`}>
        {requesting ? "Sending code…" : "Email me a code"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create `app/signin/page.js`**

```jsx
import { SignInButton } from "@clerk/nextjs";
import TenantSignIn from "@/components/TenantSignIn";

export const metadata = { title: "Sign in — Atlas" };

const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600";

// The unified front door: landlords keep the existing Clerk modal; tenants
// verify with an emailed one-time code.
export default function SignInPage() {
  return (
    <section className="min-h-screen bg-cream pt-32 pb-20">
      <div className="mx-auto w-full max-w-4xl px-6">
        <span className="eyebrow text-teal">Sign in</span>
        <h1 className="mt-2 font-serif text-4xl font-bold text-navy">Welcome back.</h1>
        <p className="mt-2 text-navy/60">Choose how you use Atlas.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Landlord */}
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="font-serif text-2xl font-bold text-navy">I&apos;m a landlord</h2>
            <p className="mt-1 text-sm text-navy/55">
              Manage your properties, leases, and AI agents.
            </p>
            <div className="mt-6">
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className={tealBtn}>Log in to your dashboard</button>
              </SignInButton>
            </div>
          </div>

          {/* Tenant */}
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="font-serif text-2xl font-bold text-navy">I&apos;m a tenant</h2>
            <p className="mt-1 text-sm text-navy/55">
              Chat with your property assistant, see your lease, and submit requests.
            </p>
            <div className="mt-6">
              <TenantSignIn />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Navbar — point "Log in" at `/signin`**

In `components/Navbar.js`, inside `AuthActions`, replace ONLY:

```jsx
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
          <button className={block ? `${navLink} py-2` : navLink}>Log in</button>
        </SignInButton>
```

with:

```jsx
        <Link href="/signin" className={block ? `${navLink} py-2` : navLink}>
          Log in
        </Link>
```

(`Link` is already imported. The `SignUpButton` block and the signed-in branch stay byte-identical. `SignInButton` remains imported and used? — NO: after this edit `SignInButton` is unused in Navbar; REMOVE `SignInButton` from the `@clerk/nextjs` import line, keeping `useUser, SignUpButton, UserButton`.)

- [ ] **Step 5: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: succeeds; `/signin` appears in the route list.

- [ ] **Step 6: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add app/signin/actions.js app/signin/page.js components/TenantSignIn.js components/Navbar.js
git commit -m "feat: unified /signin front door with tenant OTP flow"
```

---

### Task 5: The tenant area — rebuilt `/tenant` (actions + page + TenantHome), retire TenantPortal

**Files:**
- Modify: `app/tenant/actions.js` (rework — full replacement shown)
- Modify: `app/tenant/page.js` (rebuild — full replacement shown)
- Create: `components/TenantHome.js`
- Delete: `components/TenantPortal.js`

**Interfaces:**
- Consumes: Task 1's session lib; Task 3's `startVerifiedTenantChat`/`sendVerifiedTenantChat`; existing `computeLeaseStatus`, `URGENCY_OPTIONS`, `getNotificationEmail`, `sendMaintenanceRequestEmail`, `STATUS_META`.
- Produces: the verified `/tenant` area; `signOutTenant`, `submitTenantRequest`, `tenantChatStart`, `tenantChatSend` actions.

- [ ] **Step 1: Replace `app/tenant/actions.js` with**

```js
"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { computeLeaseStatus } from "@/lib/leases";
import { URGENCY_OPTIONS } from "@/lib/maintenance";
import { getNotificationEmail } from "@/lib/profiles";
import { sendMaintenanceRequestEmail } from "@/lib/notifications";
import { readTenantSession, clearTenantSessionCookie } from "@/lib/tenantSession";
import { startVerifiedTenantChat, sendVerifiedTenantChat } from "@/lib/services/chat";

// Internal: the verified email's leases across all properties. Only ever
// called with a session-verified email (never client input).
export async function lookupTenant(email) {
  const e = (email || "").toString().trim().toLowerCase();
  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  const { data, error } = await supabase
    .from("leases")
    .select("id, property_id, tenant_name, unit_number, lease_start, lease_end, properties(name, address)")
    .ilike("tenant_email", e)
    .order("lease_end", { ascending: true });

  if (error) {
    console.error("tenant lookup failed:", error.message);
    return { error: "Couldn't look up your lease — please try again." };
  }

  const leases = (data || []).map((l) => ({
    id: l.id,
    propertyId: l.property_id,
    propertyName: l.properties?.name || "Your property",
    propertyAddress: l.properties?.address || null,
    unitNumber: l.unit_number || null,
    leaseStart: l.lease_start,
    leaseEnd: l.lease_end,
    status: computeLeaseStatus(l.lease_end), // computed fresh from today's date
  }));

  return { email: e, leases };
}

// Signs the tenant out (clears the session cookie).
export async function signOutTenant() {
  await clearTenantSessionCookie();
  redirect("/signin");
}

// Submit a maintenance request as a VERIFIED tenant. The email comes from the
// session, never the form; the lease re-check scopes the request.
export async function submitTenantRequest(prevState, formData) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  const email = session.email;

  const propertyId = (formData.get("property_id") || "").toString().trim();
  const title = (formData.get("title") || "").toString().trim();
  const description = (formData.get("description") || "").toString().trim();
  const urgencyInput = (formData.get("urgency") || "").toString().trim();
  const urgency = URGENCY_OPTIONS.includes(urgencyInput) ? urgencyInput : "normal";

  if (!title) return { error: "Please describe the issue." };

  const supabase = getSupabase();
  if (!supabase) return { error: "Something went wrong — please try again later." };

  // Confirm this verified email has a lease at this property, and grab the
  // landlord (user_id) plus the property name for the notification email.
  const { data: leaseRows } = await supabase
    .from("leases")
    .select("user_id, property_id, properties(name)")
    .ilike("tenant_email", email)
    .eq("property_id", propertyId)
    .limit(1);
  const lease = leaseRows?.[0];
  if (!lease) return { error: "We couldn't match your email to a lease at this property." };

  const { error } = await supabase.from("maintenance_requests").insert({
    property_id: lease.property_id,
    user_id: lease.user_id,
    title,
    description: description || null,
    urgency,
    status: "open",
  });

  if (error) {
    console.error("tenant request failed:", error.message);
    return { error: "Couldn't submit your request — please try again." };
  }

  // Best-effort: email the landlord at their saved notification address.
  try {
    const to = await getNotificationEmail(lease.user_id);
    if (to) {
      await sendMaintenanceRequestEmail({
        to,
        propertyId: lease.property_id,
        propertyName: lease.properties?.name,
        request: { title, description, urgency },
        tenantEmail: email,
      });
    }
  } catch (e) {
    console.error("tenant request email failed:", e.message);
  }

  return { success: true };
}

// Chat actions for the tenant home — identity from the session only.
export async function tenantChatStart(propertyId) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  return startVerifiedTenantChat(session.email, propertyId);
}

export async function tenantChatSend(propertyId, chatId, text) {
  const session = await readTenantSession();
  if (!session) return { error: "Your session expired — please sign in again." };
  return sendVerifiedTenantChat(session.email, propertyId, chatId, text);
}
```

- [ ] **Step 2: Replace `app/tenant/page.js` with**

```jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/tenantSession";
import { lookupTenant, signOutTenant } from "./actions";
import TenantHome from "@/components/TenantHome";

export const metadata = { title: "Tenant portal — Atlas" };
export const dynamic = "force-dynamic";

// The verified tenant area. No session -> /signin. With a session, route on
// the verified email's leases: none -> contact-manager card; one -> home;
// several -> property picker (?p=<propertyId>, validated server-side).
export default async function TenantPage({ searchParams }) {
  const session = await readTenantSession();
  if (!session) redirect("/signin");

  const res = await lookupTenant(session.email);
  if (res.error) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
            <p className="text-navy/70">{res.error}</p>
          </div>
        </div>
      </section>
    );
  }

  const leases = res.leases;

  // No lease on file for this verified email.
  if (leases.length === 0) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
            <p className="font-semibold text-navy">
              We couldn&apos;t find a lease for that email — contact your property manager.
            </p>
            <p className="mt-1 text-sm text-navy/55">
              You verified <span className="font-semibold text-navy">{session.email}</span>. If your
              landlord has a different email on file, sign in with that one.
            </p>
            <form action={signOutTenant} className="mt-4">
              <button className="text-sm font-semibold text-teal hover:text-teal-600">Switch email</button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // Distinct properties this tenant has leases at.
  const properties = [];
  const seen = new Set();
  for (const l of leases) {
    if (!seen.has(l.propertyId)) {
      seen.add(l.propertyId);
      properties.push({ id: l.propertyId, name: l.propertyName, address: l.propertyAddress });
    }
  }

  const sp = (await searchParams) || {};
  const picked = (sp.p || "").toString();
  const validPick = properties.find((p) => p.id === picked)?.id || null;
  const selectedPropertyId = properties.length === 1 ? properties[0].id : validPick;

  // Several properties, none picked yet -> picker.
  if (!selectedPropertyId) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <span className="eyebrow text-teal">Tenant portal</span>
          <h1 className="mt-2 font-serif text-4xl font-bold text-navy">Which property?</h1>
          <p className="mt-2 text-navy/60">
            Signed in as <span className="font-semibold text-navy">{session.email}</span>
          </p>
          <div className="mt-8 space-y-4">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/tenant?p=${p.id}`}
                className="block rounded-3xl border border-navy/10 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-teal/40"
              >
                <h2 className="font-serif text-2xl font-bold text-navy">{p.name}</h2>
                {p.address && <p className="mt-1 text-navy/60">{p.address}</p>}
              </Link>
            ))}
          </div>
          <form action={signOutTenant} className="mt-6">
            <button className="text-sm font-medium text-teal hover:text-teal-600">Switch email</button>
          </form>
        </div>
      </section>
    );
  }

  // The most relevant lease at the selected property (latest lease_end).
  const propertyLeases = leases.filter((l) => l.propertyId === selectedPropertyId);
  const lease = propertyLeases[propertyLeases.length - 1];

  return (
    <section className="min-h-screen bg-cream pt-32 pb-20">
      <div className="mx-auto w-full max-w-3xl px-6">
        <TenantHome
          email={session.email}
          lease={lease}
          propertyId={selectedPropertyId}
          multiProperty={properties.length > 1}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create `components/TenantHome.js`**

```jsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  signOutTenant,
  submitTenantRequest,
  tenantChatStart,
  tenantChatSend,
} from "@/app/tenant/actions";
import { STATUS_META as LEASE_STATUS_META } from "@/lib/leases";
import { CheckIcon } from "./icons";

const field =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";
const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600 disabled:opacity-60";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }) {
  const meta = LEASE_STATUS_META[status] || LEASE_STATUS_META.active;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

// The verified tenant's chat — same UI language as the dashboard test console.
// The hidden priming never appears here: the server returns only the agent's
// greeting reply.
function TenantChat({ propertyId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(null);
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, starting]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const res = await tenantChatStart(propertyId);
      setStarting(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.noLease) {
        setError("We couldn't match your lease — try signing in again.");
        return;
      }
      setChatId(res.chatId);
      setMessages(res.greeting?.trim() ? [{ role: "agent", text: res.greeting }] : []);
    })();
  }, [propertyId]);

  async function onSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !chatId) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    const res = await tenantChatSend(propertyId, chatId, text);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMessages((m) => [...m, { role: "agent", text: res.reply }]);
  }

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white">
      <div className="flex items-center gap-2 border-b border-navy/10 bg-white px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-teal" />
        <span className="text-sm font-semibold text-navy">Your property assistant</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-cream px-5 py-4">
        {messages.length === 0 && !starting && !loading && !error && (
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
                  : "rounded-bl-md border border-navy/10 bg-white text-navy"
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

function RequestForm({ propertyId }) {
  const [formKey, setFormKey] = useState(0);
  return <RequestFormInner key={formKey} propertyId={propertyId} onReset={() => setFormKey((k) => k + 1)} />;
}

function RequestFormInner({ propertyId, onReset }) {
  const [state, formAction, pending] = useActionState(submitTenantRequest, {});

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-teal/30 bg-teal/10 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
          <CheckIcon className="h-6 w-6" />
        </span>
        <p className="font-serif text-xl font-bold text-navy">Request submitted!</p>
        <p className="text-navy/60">Your property manager has been notified and will follow up.</p>
        <button onClick={onReset} className="mt-2 text-sm font-semibold text-teal hover:text-teal-600">
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <h2 className="text-xl font-bold text-navy">Submit a maintenance request</h2>
      <p className="text-sm text-navy/55">We&apos;ll send it straight to your property manager.</p>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="property_id" value={propertyId} />
        <div>
          <label className={label}>Issue</label>
          <input name="title" required placeholder="e.g. Leaking faucet in the kitchen" className={field} />
        </div>
        <div>
          <label className={label}>Details</label>
          <textarea name="description" rows={3} placeholder="When did it start, where exactly, access notes…" className={field} />
        </div>
        <div>
          <label className={label}>Urgency</label>
          <select name="urgency" defaultValue="normal" className={field}>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={tealBtn}>
            {pending ? "Submitting…" : "Submit request"}
          </button>
          {state?.error && <span className="text-sm font-medium text-coral">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}

// The verified tenant home: chat front and center, lease card, request form.
export default function TenantHome({ email, lease, propertyId, multiProperty }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="eyebrow text-teal">Tenant portal</span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-navy">{lease.propertyName}</h1>
          <p className="mt-1 text-sm text-navy/60">
            Signed in as <span className="font-semibold text-navy">{email}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {multiProperty && (
            <Link href="/tenant" className="text-sm font-medium text-teal hover:text-teal-600">
              Change property
            </Link>
          )}
          <form action={signOutTenant}>
            <button className="text-sm font-medium text-teal hover:text-teal-600">Switch email</button>
          </form>
        </div>
      </div>

      <TenantChat propertyId={propertyId} />

      {/* Lease card */}
      <div className="rounded-3xl border border-navy/10 bg-white p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-bold text-navy">Your lease</h2>
            {lease.propertyAddress && <p className="mt-1 text-navy/60">{lease.propertyAddress}</p>}
            {lease.unitNumber && <p className="text-sm text-navy/55">Unit {lease.unitNumber}</p>}
          </div>
          <StatusBadge status={lease.status} />
        </div>
        <div className="mt-5 grid gap-4 border-t border-navy/10 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/45">Lease ends</p>
            <p className="mt-1 font-serif text-xl font-bold text-navy">{fmtDate(lease.leaseEnd)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-navy/45">Lease started</p>
            <p className="mt-1 font-serif text-xl font-bold text-navy">{fmtDate(lease.leaseStart)}</p>
          </div>
        </div>
      </div>

      <RequestForm propertyId={propertyId} />
    </div>
  );
}
```

- [ ] **Step 4: Delete `components/TenantPortal.js` and confirm nothing imports it**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git rm components/TenantPortal.js
grep -rn "TenantPortal" app components lib ; echo "references above (should be none)"
```
Expected: grep prints nothing.

- [ ] **Step 5: Build**

Run: `cd /Users/akhil/Technology/Atlas/Atlas_Website && npm run build`
Expected: succeeds; `/tenant` builds as dynamic.

- [ ] **Step 6: Commit**

```bash
cd /Users/akhil/Technology/Atlas/Atlas_Website
git add app/tenant/actions.js app/tenant/page.js components/TenantHome.js
git commit -m "feat: verified tenant home with chat, lease card, and requests"
```
(The `git rm` from Step 4 is already staged.)

---

### Task 6: Verification + deploy (developer-run)

**Files:** none. The implementer does NOT run these — present to the developer.

- [ ] **Step 1: Local setup** — add to `.env.local`: `TENANT_SESSION_SECRET=<output of: openssl rand -hex 32>`. Run migration 0013 in the Supabase SQL editor (both statements).

- [ ] **Step 2: Build + curl-level checks** (`npm run dev` running)
1. Request a code from `/signin` with your own email → `tenant_otps` row exists (Supabase editor): `code_hash` is a 64-char hex (not the code), `expires_at` ~10 min out, `attempts` 0.
2. Enter a wrong code 5 times → the 6th attempt (even if correct) shows "Too many attempts — request a new code."
3. Request a fresh code → correct code → lands on `/tenant`; the `tenant_otps` row is gone (single-use).
4. In Supabase, set a row's `expires_at` to the past → verifying shows "That code has expired — request a new one."

- [ ] **Step 3: Browser smoke** (spec's checklist)
1. `/signin` renders both cards; the landlord card opens the Clerk modal (regression).
2. Tenant path end-to-end with your email (free-tier delivers to the account owner): neutral confirmation → code arrives → wrong code errors → correct code → `/tenant`.
3. Routing: one lease → home; two leases on the email (create a second temporarily) → picker → pick → home → "Change property" works; an email with no lease → the contact-manager card + Switch email.
4. Tenant home: the chat greets by name/unit with NO priming text visible; lease questions answered; lease card + badge correct; maintenance request submits → appears on the landlord dashboard + notification email.
5. Supabase `conversations`: tenant-chat rows carry `tenant_email`; make one test-console chat → its row has `tenant_email` null.
6. Reload `/tenant` → still signed in. Switch email → `/signin`, cookie cleared (devtools). 
7. Landlord regression: navbar "Log in" → `/signin`; "Start Free Trial" modal unchanged; dashboard + test console behave identically.

- [ ] **Step 4: Deploy** — set `TENANT_SESSION_SECRET` in Vercel env (Production); confirm migration 0013 was run against the production Supabase. THEN use `superpowers:finishing-a-development-branch` to merge `tenant-signin` → `main` and push (Vercel deploys).

---

## Notes for the executor

- Tasks 1–3 are services/foundations with complete code (haiku transcription); Task 4 and 5 are larger UI tasks but also carry complete code. Review Tasks 2, 3, and 5 with security focus: identity-from-session-only, hashed codes, attempt cap, the append-only constraint on chat.js, and `submitTenantRequest` never reading an email from formData.
- `redirect()` throws in Next — it must never be wrapped in try/catch in the new actions (`verifyCode`, `signOutTenant`).
- `lookupTenant` keeps its global-by-email query — that is BY DESIGN (post-verification routing). What changed is that it is only ever invoked with `readTenantSession().email`.
- The chat.js change MUST be purely additive — Step 2 of Task 3 verifies zero deletion lines. The dashboard test console and mobile chat routes depend on the existing functions byte-for-byte.
- Do not stage the developer's local `.gitignore` edit in any commit.
