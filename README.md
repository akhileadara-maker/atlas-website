# Atlas

An AI-powered property management platform — a marketing site **and** a working
landlord dashboard. Built with **Next.js 15** (App Router) and **Tailwind CSS v4**.

- **Marketing site** — Home, Features, Pricing, About, Demo.
- **Auth** — sign up / log in with [Clerk](https://clerk.com).
- **Dashboard** — landlords add properties (stored in [Supabase](https://supabase.com)).
- **AI agents** — each property automatically gets a [Retell](https://retellai.com)
  knowledge base + chat agent; landlords fill in a KB form and test the agent live.
- **Billing** — per-unit subscriptions via [Stripe](https://stripe.com) Checkout + webhooks.

## Tech stack

| Concern | Tool |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS v4 (brand tokens in `app/globals.css`) |
| Auth | `@clerk/nextjs` |
| Database | Supabase (Postgres, RLS on, service-role key server-side) |
| AI agents | Retell REST API (chat agents + knowledge bases) |
| Payments | `stripe` (Checkout + webhooks) |

## 1. Environment variables

Create `.env.local` in the project root (it's git-ignored). You need keys from
four services:

```bash
# Clerk (clerk.com → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Supabase (project → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...      # public
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...               # server-only, never expose

# Retell (dashboard.retellai.com → API Keys)
RETELL_API_KEY=key_...
RETELL_TEMPLATE_AGENT_ID=agent_...                    # optional; the chat agent cloned per property

# Stripe (dashboard.stripe.com, TEST mode → Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...                    # currently unused (hosted Checkout)
STRIPE_WEBHOOK_SECRET=whsec_...                       # from `stripe listen` (see below)
```

> Server-only secrets (`*_SERVICE_ROLE_KEY`, `RETELL_API_KEY`, `STRIPE_SECRET_KEY`)
> are read only in server code guarded by `import "server-only"`, so they never reach
> the browser.

## 2. Database migrations

Run each file in **Supabase → SQL Editor** (in order), from `supabase/migrations/`:

| File | What it does |
|---|---|
| `0001_create_properties.sql` | `properties` table |
| `0002_enable_rls.sql` | turns on Row Level Security |
| `0003_add_retell_columns.sql` | `retell_agent_id`, `retell_kb_id` |
| `0004_add_kb_data.sql` | `kb_data` (JSON) for the KB editor |
| `0005_create_subscriptions.sql` | `subscriptions` table for billing |

## 3. Run it locally

```bash
npm install      # first time only
npm run dev      # http://localhost:3000
```

`npm run build` / `npm run start` for a production build.

### Stripe webhook (for billing to update locally)

In a second terminal, forward Stripe events to the local webhook **using your
project's key** (so the CLI is on the same Stripe account as the app):

```bash
stripe listen --api-key "$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d '=' -f2)" \
  --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.
Test cards: `4242 4242 4242 4242`, any future date / CVC.

## 4. Deploy (Vercel)

Import the GitHub repo, then add **all** the env vars above under
**Settings → Environment Variables**. For the webhook, create an endpoint in the
Stripe dashboard pointing at `https://<your-domain>/api/webhooks/stripe` and use its
signing secret as `STRIPE_WEBHOOK_SECRET`. Every push to `main` auto-deploys.

## Project structure

```
app/
  layout.js                     Root layout — ClerkProvider, fonts, Navbar, Footer
  page.js                       Marketing home
  features|pricing|about|demo/  Marketing pages
  globals.css                   Tailwind + brand tokens
  dashboard/
    page.js                     Landlord dashboard (properties, stats, plan badge)
    [id]/page.js                Property detail — edit/delete, KB editor, chat widget
    [id]/actions.js             Server actions: update/delete property, save KB, chat
    billing/page.js             Plans, current plan, subscribe
    billing/actions.js          createCheckoutSession (Stripe Checkout)
  api/webhooks/stripe/route.js  Stripe webhook → updates subscriptions

middleware.js                   Clerk middleware (protects /dashboard)

lib/
  supabase.js       Server-only Supabase client (service-role key)
  retell.js         Retell REST: create/clone agent, update KB, chat
  stripe.js         Server-only Stripe client
  plans.js          Plan + Stripe price-id config
  subscription.js   Unit count + subscription helpers

components/
  Navbar.js, Footer.js, Hero.js, …       Marketing + chrome
  AddProperty.js, EditPropertyForm.js,   Dashboard UI
  DeletePropertyButton.js, KnowledgeBaseEditor.js,
  ChatWidget.js, SubscribeButton.js
  icons.js                               Inline SVG icons

supabase/migrations/             SQL migrations (run in the Supabase SQL editor)
```

## Brand tokens

Defined in `app/globals.css` under `@theme`, usable as Tailwind classes:

| Token | Hex | Example |
|-------|-----|---------|
| navy | `#1A2A41` | `bg-navy`, `text-navy` |
| teal | `#2A9D8E` | `bg-teal`, `text-teal` |
| gold | `#D3A476` | `text-gold` |
| coral | `#D97E69` | `text-coral` |
| cream | `#FAFAF8` | `bg-cream` |
| bodygray | `#E8EDF2` | `text-bodygray` |

Change a value in `@theme` and it updates everywhere.

## Notes

- The marketing **trial form** (`components/TrialForm.js`) is front-end only.
- `_static-demo/` holds the original plain HTML/CSS/JS version — safe to delete.
- Each property's Retell agent is cloned from the template chat agent
  (`RETELL_TEMPLATE_AGENT_ID`); deleting a property tears down its agent + KB.
