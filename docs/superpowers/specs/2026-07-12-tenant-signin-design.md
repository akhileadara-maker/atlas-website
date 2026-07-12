# Atlas Website — Verified Tenant Sign-In (Unified Front Door) — Design

**Date:** 2026-07-12
**Status:** Approved by developer (all seven sections; plus: tenant chats logged WITH tenant identity on the row; /signin front door with navbar link)
**Repo:** `Atlas_Website` (LIVE PRODUCTION — deploys to Vercel on push to `main`). **Rule-1** change: feature branch `tenant-signin`; `npm run build` + curl checks + developer browser smoke; merge + push (deploy) only after the smoke passes. Deploy-time developer steps: run migration 0013 in the Supabase SQL editor; set `TENANT_SESSION_SECRET` in Vercel (and `.env.local`).
**Baseline:** `Atlas_Website` `main` at `46db3df`.

## Goal

Replace the unverified email-lookup tenant experience with a verified one: a unified `/signin` front door (landlord = existing Clerk modal, unchanged; tenant = email + 6-digit code), a signed ~30-day tenant session, lease-lookup routing after verification, and a tenant home with the lease-aware chat (first tenant chat on the web), lease card, and maintenance-request form — while preserving every security invariant (identity from the verified session only; scoped queries + RLS unchanged; hidden priming never shown/logged; no secrets client-side).

## Ground truth (verified against the repo, 2026-07-12)

- **There is no public property page.** The email-gated chat exists only in the dashboard "Test your agent" console (`components/ChatWidget.js`, mounted at `app/dashboard/[id]/page.js:109`, Clerk-gated) and in the mobile app (Clerk-gated). The public `/tenant` page (`components/TenantPortal.js`) has only email lookup → lease cards → maintenance form. **Web tenants have no chat today** — the tenant home adds it, reusing the proven chat machinery.
- **Chat services are landlord-scoped** (`lib/services/chat.js`: every function requires `userId` and scopes `.eq("user_id", userId)`). Tenants are not Clerk users → new tenant-session-scoped service variants are required.
- **The global email→lease lookup** is `lookupTenant(email)` (`app/tenant/actions.js:12-42`): `from("leases").select(... properties(name,address)).ilike("tenant_email", e).order("lease_end")` — global across landlords by design. It survives as the post-verification routing query, called only with a session-verified email.
- **Hidden priming** = `composeTenantContext(lease)` (`lib/services/chat.js:12-36`), sent as the first `sendChatMessage`; never inserted into `conversations`. UNCHANGED by this feature.
- **No cookie/session/crypto utilities exist** anywhere in the app (Clerk is the only auth). This feature introduces the first non-Clerk session.
- **Email:** `sendEmail({to, subject, html}) → {sent}` (`lib/resend.js`), best-effort, never throws; FROM falls back to `onboarding@resend.dev` (free tier delivers only to the account owner's email until a domain is verified — the flow is built now and works fully once the domain lands).
- **Migrations:** highest is `0012`. `leases` has `tenant_email text` (nullable), `user_id text` (the landlord), `property_id`. `conversations` has `property_id, user_id, tenant_message, agent_response` (+ id, created_at).
- **Landlord sign-in today** is a Clerk **modal** from the navbar (`components/Navbar.js:49-54`, `SignInButton mode="modal"`); there is no `/sign-in` route.

## Decisions (all developer-approved)

| Decision | Choice |
|---|---|
| Verification mechanism | Custom 6-digit OTP over Resend + HMAC-signed cookie session. (Clerk-for-tenants rejected: pollutes the user base for renters. Magic links rejected: code-entry specified.) Zero new dependencies — Node `crypto` only. |
| Front door | New public `/signin` page, two cards: "I'm a landlord" → existing Clerk `SignInButton mode="modal"` (mechanism unchanged); "I'm a tenant" → the OTP flow inline. **Navbar "Log in" becomes a `Link` to `/signin`** ("Start Free Trial" Clerk button unchanged). |
| Tenant chat logging | **Logged**, to the existing `conversations` table with `user_id` = the property owner (derived from the lease row) **and NEW `tenant_email` = the verified email** — enables the follow-up per-tenant inbox (the grouped inbox UI itself is OUT of this build's scope). Test-console rows leave `tenant_email` null. Priming is never logged either way. |
| Session | Stateless signed cookie (no server session store — YAGNI v1): payload `{email, exp}`, HMAC-SHA256 with `TENANT_SESSION_SECRET`, ~30 days, httpOnly + secure + sameSite=lax. Sign out / Switch email clears it. |
| OTP policy | 10-minute expiry; max **5** verify attempts (each failure increments; cap kills the code); re-request replaces the old code (upsert on email); codes stored as **sha256 hashes**, never plaintext. |
| Anti-enumeration | The request-code response is identical whether or not the email matches a lease: "If that email is on a lease, a code is on its way." Lease existence is revealed only AFTER a correct code (the none-found state). |
| Retirement | The old unverified `TenantPortal` lookup UI is superseded; `submitTenantRequest` takes its email from the SESSION, never the form. The dashboard test console stays byte-identical. |
| Middleware | Unchanged. `/signin` and `/tenant` are public routes; protection is the in-page/in-action session check (mirroring how Clerk pages check `auth()`). |

## Changes

### A. Migration — `supabase/migrations/0013_tenant_verification.sql` (developer runs by hand)
1. `tenant_otps`: `email text primary key` (stored lowercased), `code_hash text not null`, `expires_at timestamptz not null`, `attempts int not null default 0`, `created_at timestamptz not null default now()`. `alter table … enable row level security` with NO policies (anon denied; service-role bypasses — the posture of every table).
2. `alter table public.conversations add column if not exists tenant_email text;` (nullable; only the verified tenant path writes it).

### B. New libraries (server-only, zero new deps)
3. **`lib/tenantSession.js`**: `mintTenantSession(email)` → signed value `base64url(JSON{email,exp}).hmacSha256`; `readTenantSession()` → `{ email } | null` (verifies signature + expiry via `cookies()`); `setTenantSessionCookie(value)` / `clearTenantSessionCookie()` (httpOnly, secure, sameSite=lax, maxAge 30d, path "/"); `isTenantSessionConfigured()` = `Boolean(process.env.TENANT_SESSION_SECRET)`. Signature comparison is constant-time (`crypto.timingSafeEqual`). The cookie name: `atlas_tenant_session`.
4. **`lib/services/tenantAuth.js`**: `requestTenantCode(email)` — shape-validate; generate 6-digit code via `crypto.randomInt`; upsert `{email, code_hash: sha256(code), expires_at: now+10min, attempts: 0}`; `sendEmail` the code (subject "Your Atlas sign-in code", simple branded HTML); ALWAYS return the same neutral success message (anti-enumeration), with `{ error }` only for malformed email / unconfigured Resend/DB/session-secret. `verifyTenantCode(email, code)` — load row; expired → "That code has expired — request a new one."; `attempts >= 5` → "Too many attempts — request a new code."; wrong → increment attempts + "That code doesn't match."; right → delete the row, return `{ ok: true }` (caller mints the session).

### C. Tenant-scoped chat services (additive, `lib/services/chat.js`)
5. **`startVerifiedTenantChat(email, propertyId)`**: load the tenant's lease by `.ilike("tenant_email", email).eq("property_id", propertyId)` (most recent by `lease_end`) — the lease row supplies the landlord `user_id`; load the property's `retell_agent_id` via the lease's own `property_id`/`user_id`; no lease → `{ noLease: true }`; prime with the UNCHANGED `composeTenantContext`; return `{ chatId, greeting, lease }`. Nothing here trusts client input beyond (session email, picked propertyId), and the pick is validated by the lease query itself.
6. **`sendVerifiedTenantChat(email, propertyId, chatId, content)`**: re-validate the lease (same query); send via `sendChatMessage`; best-effort insert into `conversations` `{ property_id, user_id: <lease.user_id>, tenant_message, agent_response, tenant_email: email }`. Logging failure never breaks the chat (existing convention).
7. The landlord-scoped `startChatSession` / `sendChat` / `startTenantChat` stay for the test console, byte-identical. Test-console inserts simply have `tenant_email` null (no code change needed there).

### D. Actions — `app/tenant/actions.js` (reworked) + new signin actions
8. **`app/signin/actions.js`** (new, "use server"): `requestCode(prevState, formData)` and `verifyCode(prevState, formData)` wrapping B4; on verified, `setTenantSessionCookie(mintTenantSession(email))` and `redirect("/tenant")`.
9. **`app/tenant/actions.js`**: `lookupTenant` becomes internal routing for the verified email (called with `readTenantSession().email`, never form input). `submitTenantRequest` reads the email from the session (rejects with a sign-in prompt if absent), re-verifies the lease at the chosen property (existing logic), inserts, and keeps the existing landlord notification email. NEW `signOutTenant()` clears the cookie + `redirect("/signin")`. NEW chat actions `tenantChatStart(propertyId)` / `tenantChatSend(propertyId, chatId, text)` wrapping C5/C6 with the session email.

### E. Pages / components
10. **`app/signin/page.js`** (new, public): eyebrow "SIGN IN", Playfair heading, two cards (`rounded-3xl border border-navy/10 bg-white p-7`): landlord card with the Clerk `SignInButton mode="modal" forceRedirectUrl="/dashboard"` (unchanged mechanism); tenant card mounting `TenantSignIn`.
11. **`components/TenantSignIn.js`** (new, client): two-step form — email → (neutral confirmation) → 6-digit code input with "Resend code" — via `useActionState` on the D8 actions; existing field/button classnames (`w-full rounded-xl border border-navy/15 bg-cream …`, teal pill button); errors in coral per convention.
12. **`app/tenant/page.js`** (rebuilt, server component): no session → `redirect("/signin")`; session → route on the verified email's leases: none → contact-manager card + "Switch email"; one → tenant home; several → property picker (cards with property name/address; pick via query param `?p=<propertyId>`, validated against the tenant's own leases server-side).
13. **`components/TenantHome.js`** (new, client): for the selected lease/property — chat card front and center (message list + input, greeting from `tenantChatStart`, replies via `tenantChatSend`; the priming block never appears in the UI — only the agent's greeting reply does); lease card (unit, dates, status badge — existing badge styling); maintenance-request form (posting the session-derived flow, D9); header row with the verified email + "Switch email" (signOutTenant). Supersedes `components/TenantPortal.js` (deleted).
14. **`components/Navbar.js`**: the signed-out "Log in" `SignInButton` is replaced with a `Link href="/signin"` styled identically; the `SignUpButton` ("Start Free Trial") and signed-in state are unchanged.

## Security invariants (binding)

- Tenant identity comes ONLY from `readTenantSession()` (signature + expiry checked, constant-time compare) — never from form/client input. Every tenant action re-derives it server-side.
- The agent is primed only with the verified tenant's lease at a property the lease query itself validates. `composeTenantContext` and its never-shown/never-logged semantics are unchanged.
- OTP codes stored hashed (sha256); 10-min expiry; 5-attempt cap; re-request replaces. Neutral request-code response (anti-enumeration).
- `TENANT_SESSION_SECRET` server-only; the cookie carries no lease data. No secrets client-side.
- Supabase remains service-role server-side; RLS-enabled-no-policies posture unchanged (new `tenant_otps` table included).
- Trust boundary for landlord surfaces unchanged (Clerk `auth()`); the test console and all dashboard/mobile paths are untouched.

## Error handling

- Resend unconfigured/down → "We couldn't send a code right now — try again in a moment." (request-code only; never blocks an already-signed-in tenant).
- DB unconfigured → existing message convention. `TENANT_SESSION_SECRET` unset → tenant sign-in card shows "Tenant sign-in isn't configured yet." (landlord card unaffected).
- Expired/invalid session mid-action → the action returns a sign-in prompt error; the page redirect handles fresh loads.
- Retell down → chat card shows the error + retry; lease card and request form unaffected. Conversation-log failure never breaks a reply (existing convention).

## Testing / exit criteria

**Gate:** `npm run build` on the branch.

**Curl-level checks (dev server):** request-code → `tenant_otps` row exists with hashed code + future expiry; 5 wrong verifies → locked ("Too many attempts"); expired row → rejected; correct code → row deleted; `submitTenantRequest` without a session cookie → rejected.

**Developer browser smoke (before merge/deploy; use your own email — free-tier delivery):**
1. `/signin` renders both cards; landlord card opens the Clerk modal (regression).
2. Tenant path: email → neutral confirmation → code arrives → wrong code shows the mismatch error → correct code lands on `/tenant`.
3. Routing: with one lease → tenant home; (if you set up two leases on the email) → picker → pick → home; with an unknown email (after verifying) → contact-manager card.
4. Tenant home: chat greets by name/unit (priming invisible); lease questions answered from the lease; multi-part question behaves per the KB prompt; lease card + status badge correct; maintenance request submits and appears on the landlord dashboard (+ notification email).
5. `conversations` rows for the tenant chat carry `tenant_email`; test-console rows do not.
6. Session: reload → still signed in (no code re-entry); Switch email → back to `/signin`, cookie gone.
7. Landlord regression: navbar Log in → `/signin`; Start Free Trial unchanged; dashboard + test console byte-identical behavior.

**Deploy steps at checkpoint:** run migration 0013 in the Supabase SQL editor; add `TENANT_SESSION_SECRET` (e.g. `openssl rand -hex 32`) in Vercel env + `.env.local`; THEN merge `tenant-signin` → `main` and push (Vercel deploys).

## Out of scope (later)

The grouped per-tenant inbox UI for landlords (this build only records `tenant_email` on the rows); server-side session revocation store; SMS codes; rate-limiting beyond the attempt cap (e.g. per-IP request throttling — revisit before heavy marketing); tenant password accounts; the mobile app's tenant experience (mobile remains the landlord app; parked `phase9-devbuild` unaffected); Resend domain verification (separate task — the flow works fully once done).
