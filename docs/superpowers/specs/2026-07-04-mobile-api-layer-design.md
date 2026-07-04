# Atlas Mobile — Phase 1: `/api/mobile/*` API Layer — Design

**Date:** 2026-07-04
**Status:** Approved by developer (extraction approach + route list + auth), pending implementation plan
**Source spec:** `../../../../Atlas_Mobile/Atlas_Mobile_App_Build_Spec.md` (Sections 3, 9, 11 Phase 1)

## Goal

Give the upcoming React Native app an authenticated HTTP boundary into the existing Next.js backend without rebuilding or breaking anything. Web and mobile must run identical business logic against the same Supabase data, Retell agents, Stripe subscriptions, and Resend email.

## Non-goals (this phase)

- No React Native / Expo code.
- No `push_tokens` table or `POST /api/mobile/notifications/register` (Phase 7, migration `0012`).
- No push sending, no deep links, no Clerk–Supabase JWT integration.
- No changes to marketing pages, tenant portal, components, Stripe webhook, cron job, or `lib/` clients.

## Decision 1 — Shared logic via extraction (approved)

The body of each Server Action moves into a plain async function in `lib/services/`, taking `userId` as the first argument. The Server Actions keep their exported names, signatures (`(prevState, formData)` where applicable), and return shapes — they parse the form, call the service, then perform their web-only side effects (`revalidatePath`, `deleteProperty`'s `redirect("/dashboard")`) exactly as today. The new API routes call the same services.

Rejected alternatives:
- **Duplicate logic in routes** — no web files touched, but two copies to maintain and web/mobile drift risk.
- **Import Server Actions from routes** — `redirect()` throws outside an action context; formData signatures don't fit JSON bodies.

### Service modules (new files, plain JS, no new dependencies)

| File | Functions | Extracted from |
|---|---|---|
| `lib/services/properties.js` | `createProperty(userId, {name, address, units})` · `getProperty(userId, id)` · `updatePropertyDetails(userId, id, {name, address, units})` · `deletePropertyById(userId, id)` · `saveKnowledgeBase(userId, id, kb)` · `getDashboardData(userId)` | `addProperty`, `updateProperty`, `deleteProperty`, `saveKnowledgeBase` actions; `getDashboardData` is written fresh from the queries in `app/dashboard/page.js` (the page itself is NOT modified) |
| `lib/services/leases.js` | `listLeases(userId, propertyId)` · `createLease(userId, propertyId, fields)` · `removeLease(userId, leaseId)` · `refreshLeaseStatuses(userId, propertyId)` | `addLease`, `deleteLease`, `refreshLeaseStatuses` actions |
| `lib/services/maintenance.js` | `listRequests(userId, propertyId)` · `createRequest(userId, propertyId, {title, description, urgency}, {landlordEmail})` · `updateRequestStatus(userId, requestId, status)` · `removeRequest(userId, requestId)` | `addMaintenanceRequest`, `updateMaintenanceStatus`, `deleteMaintenanceRequest` actions |
| `lib/services/chat.js` | `startChatSession(userId, propertyId)` · `sendChat(userId, propertyId, chatId, content)` · `startTenantChat(userId, propertyId, email)` | Same-named actions |
| `lib/services/billing.js` | `createCheckoutSession(userId, planKey, {baseUrl, email})` | `createCheckoutSession` action; `headers()`/`currentUser()` stay in callers |

Helper placement: `composeSystemPrompt` and `composeKbText` move with `saveKnowledgeBase` into `lib/services/properties.js`; `composeTenantContext` moves with `startTenantChat` into `lib/services/chat.js`. They are module-private today and stay module-private.

### Existing files modified (delegation only)

- `app/dashboard/actions.js` — `addProperty` delegates to `createProperty`.
- `app/dashboard/[id]/actions.js` — all 12 actions delegate; return shapes unchanged.
- `app/dashboard/billing/actions.js` — `createCheckoutSession` delegates, passing `baseUrl` (from `headers()`) and email (from `currentUser()`).
- `middleware.js` — see Decision 3.

Behavioral invariants preserved (spec Section 8): Retell lifecycle (best-effort create on add, teardown on delete, KB + system prompt + language re-sync on save), unlogged priming message, Resend email side effects, `expiry_notified_at` dedupe, `{ error }`/`{ success: true }` contracts, graceful no-op when clients are unconfigured, `userId` only from the verified Clerk session.

## Decision 2 — Route surface (approved)

All under `app/api/mobile/`, thin handlers: authenticate → parse/validate → call service → JSON with status code.

| Method + path | Service call | Notes |
|---|---|---|
| `GET /api/mobile/dashboard` | `getDashboardData` | `{ stats: { totalUnits, activeLeases, openRequests, expiringSoon }, properties: [{ id, name, address, units, created_at, agentReady, leaseCount, openRequestCount }] }`. Runs the same best-effort `saveNotificationEmail` as the web dashboard. |
| `POST /api/mobile/properties` | `createProperty` | Body `{ name, address, units }`. Best-effort Retell creation; missing agent = "Agent pending" on clients. |
| `GET /api/mobile/properties/:id` | `getProperty` | Property row incl. `kb_data`; fires the same best-effort, deduped `notifyExpiringLeases` as the web property page. |
| `PATCH /api/mobile/properties/:id` | `updatePropertyDetails` | Body `{ name, address, units }`. |
| `DELETE /api/mobile/properties/:id` | `deletePropertyById` | Retell teardown + DB cascade; returns `{ success: true }` (no redirect). |
| `POST /api/mobile/properties/:id/kb` | `saveKnowledgeBase` | Body = the 11 `kb_data` fields; re-syncs Retell KB, system prompt, language. Partial-failure message preserved ("Saved your info, but updating the AI agent failed: …"). |
| `GET /api/mobile/properties/:id/leases` | `listLeases` | Recomputes/persists stale statuses first (mirrors `refreshLeaseStatuses`). |
| `POST /api/mobile/properties/:id/leases` | `createLease` | Body `{ tenant_name, tenant_email, unit_number, monthly_rent, lease_start, lease_end }`. |
| `DELETE /api/mobile/leases/:id` | `removeLease` | |
| `GET /api/mobile/properties/:id/requests` | `listRequests` | Newest first, as web. |
| `POST /api/mobile/properties/:id/requests` | `createRequest` | Body `{ title, description, urgency }`; Resend email side effect preserved. |
| `PATCH /api/mobile/requests/:id` | `updateRequestStatus` | Body `{ status }`, validated against `STATUS_OPTIONS`. |
| `DELETE /api/mobile/requests/:id` | `removeRequest` | |
| `POST /api/mobile/properties/:id/chat/start` | `startTenantChat` | Body `{ email }`. Returns `{ chatId, greeting, lease }` or `{ noLease: true }`. Priming message never logged or returned. |
| `POST /api/mobile/properties/:id/chat/send` | `sendChat` | Body `{ chatId, content }`. Logs exchange to `conversations` (best-effort). |
| `GET /api/mobile/billing` | `getSubscription` + `getUnitCount` + `PLANS` | `{ plan, status, units, billedUnits, active }`. |
| `POST /api/mobile/billing/checkout` | `createCheckoutSession` | Body `{ planKey }` → `{ url }`. v1 reuses web success/cancel URLs (`/dashboard/billing?success=1` etc.); the in-app browser shows the web confirmation. Deep-link return is Phase 9 polish. |

Deferred: `POST /api/mobile/notifications/register` → Phase 7 with migration `0012_create_push_tokens`.

### Error / status conventions

- `401` `{ error: "You must be signed in." }` — no valid Clerk session.
- `400` `{ error: … }` — validation failures, using today's exact action messages ("Property name is required.", "Invalid status.", "Please enter a valid email address.", …).
- `404` `{ error: "Property not found." }` — row missing or owned by someone else (indistinguishable, as today).
- `503` `{ error: "The database isn't configured." / "Billing isn't configured (missing Stripe/Supabase env vars)." }` — unconfigured clients; mirrors graceful degradation.
- `200` — success payloads above. Domain "soft" results that aren't errors (e.g. `{ noLease: true }`) are `200`.
- Upstream (Retell/Stripe) failures surface as `502` with the same message text the actions return today.

## Decision 3 — Auth (approved)

- Mobile obtains the Clerk session token via `@clerk/clerk-expo` (`getToken()`, same Clerk instance as web) and sends `Authorization: Bearer <token>` on every `/api/mobile/*` call. Clerk's `auth()` in route handlers verifies Bearer tokens natively.
- `middleware.js`: add an `isMobileApi = createRouteMatcher(["/api/mobile(.*)"])`; when it matches and there is no `userId`, return `401` JSON — not `redirectToSignIn()` (browser-only behavior). The existing `/dashboard(.*)` redirect behavior is untouched.
- Defense in depth: every route handler also calls `await auth()` itself; every service function requires `userId` and scopes queries `.eq("user_id", userId)`. `user_id` is never read from a request body.
- Secrets: unchanged. Service-role, Stripe, Retell, Resend keys stay server-side; the mobile app will ship only the Clerk publishable key and the API base URL (spec Section 9).

## Testing / verification

No test suite exists in the repo. Verification for this phase:

1. `npm run build` passes after the refactor.
2. Manual web smoke pass of every delegated flow: add/edit/delete property, KB save (confirm Retell sync), add/delete lease, add/update/delete maintenance request (confirm email), landlord chat, tenant-email chat (incl. unknown-email path), checkout session creation.
3. `curl` pass over every new route: happy path, missing token (expect 401), foreign `:id` (expect 404), invalid body (expect 400).
4. Confirm tenant portal and marketing pages are untouched (`git diff` limited to the files listed above plus new files).

## Build order within Phase 1

1. Create `lib/services/*` with extracted logic; delegate the three actions files; web smoke pass. (Reviewable checkpoint — web must be fully working here.)
2. Add middleware matcher + the 17 route handlers (the 18th, `notifications/register`, is deferred to Phase 7); curl pass.
