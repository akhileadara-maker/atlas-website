# Atlas — Marketing Website

The marketing site for **Atlas**, an AI-powered property management platform.
Built with **Next.js 15** (App Router) and **Tailwind CSS v4**.

## Run it locally

```bash
npm install     # first time only — downloads dependencies
npm run dev      # start the dev server
```

Then open **http://localhost:3000** in your browser.

## Build for production

```bash
npm run build    # creates an optimized production build
npm run start    # serves the production build on http://localhost:3000
```

## Project structure

```
app/
  layout.js          Root layout — fonts (Playfair Display + Inter), Navbar, Footer
  page.js            Home page (composes the sections below)
  globals.css        Tailwind import + brand design tokens
  features/page.js   Features page
  pricing/page.js    Pricing page
  about/page.js      About page
  demo/page.js       Demo + free-trial signup

components/
  Navbar.js / Footer.js          Site chrome
  Hero.js, PainSection.js, …     Home page sections
  Pricing.js, ComparisonTable.js Reused on Home + Pricing
  ChatMockup.js                  The AI-chat product mockup
  Reveal.js                      Scroll-in animation wrapper
  Button.js, Container.js, …     Reusable UI primitives
  icons.js                       Inline SVG icon set
```

## Brand tokens

Defined in `app/globals.css` under `@theme` and usable as Tailwind classes:

| Token | Hex | Example class |
|-------|-----|---------------|
| navy | `#1A2A41` | `bg-navy`, `text-navy` |
| teal | `#2A9D8E` | `bg-teal`, `text-teal` |
| gold | `#D3A476` | `text-gold` |
| coral | `#D97E69` | `text-coral` |
| cream | `#FAFAF8` | `bg-cream` |
| bodygray | `#E8EDF2` | `text-bodygray` |

To change a brand color site-wide, edit its value in `@theme` — every component updates.

## Notes

- The trial form (`components/TrialForm.js`) is front-end only. Hook it up to an API
  route or a form service (e.g. Formspree) to actually capture leads.
- `_static-demo/` holds the earlier plain HTML/CSS/JS version — safe to delete.
