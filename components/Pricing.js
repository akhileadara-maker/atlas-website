import Container from "./Container";
import Reveal from "./Reveal";
import Button from "./Button";
import TrialSignUpButton from "./TrialSignUpButton";
import SectionHeading from "./SectionHeading";
import { CheckIcon } from "./icons";

// Volume tiers: every plan is the FULL product — the rate simply drops as the
// portfolio grows. Keep in step with lib/plans.js.
const tiers = [
  {
    name: "Starter",
    range: "1–49 units",
    price: "$15",
    unit: "/ unit / mo",
    tagline: "Everything Atlas does, from your first unit.",
    featured: false,
  },
  {
    name: "Growth",
    range: "50–300 units",
    price: "$10",
    unit: "/ unit / mo",
    tagline: "Your rate drops automatically as you grow.",
    featured: true,
  },
  {
    name: "Portfolio",
    range: "300+ units",
    price: "$6",
    unit: "/ unit / mo",
    tagline: "Our best rate for large portfolios.",
    featured: false,
  },
];

// Every tier includes the whole platform — one list, shown on every card.
const includedEverywhere = [
  "24/7 Tenant AI — chat, any language",
  "Lease tracking & 90-day renewal alerts",
  "Maintenance intake & dispatch",
  "Verified tenant portal",
  "Email + push notifications",
];

export default function Pricing({ showHeading = true }) {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <Container>
        {showHeading && (
          <SectionHeading
            eyebrow="How we make money"
            title="One product. Volume pricing."
            subtitle="Every plan includes all of Atlas. Your rate is set by your portfolio size — and drops automatically as you grow."
          />
        )}

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 100}>
              <div
                className={`relative flex h-full flex-col rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 ${
                  tier.featured
                    ? "bg-navy text-cream shadow-2xl shadow-navy/30 ring-2 ring-teal"
                    : "border border-navy/10 bg-white text-navy hover:shadow-xl hover:shadow-navy/5"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}
                <h3
                  className={`text-sm font-semibold uppercase tracking-wider ${
                    tier.featured ? "text-gold" : "text-teal"
                  }`}
                >
                  {tier.name}
                </h3>
                <p className={`mt-1 text-sm font-semibold ${tier.featured ? "text-bodygray/80" : "text-navy/55"}`}>
                  {tier.range}
                </p>
                <p className="mt-4 font-serif text-5xl font-bold">
                  {tier.price}
                  <span
                    className={`ml-1 text-base font-medium ${
                      tier.featured ? "text-bodygray/60" : "text-navy/45"
                    }`}
                  >
                    {tier.unit}
                  </span>
                </p>
                <p className={`mt-3 text-sm ${tier.featured ? "text-bodygray/75" : "text-navy/60"}`}>
                  {tier.tagline}
                </p>

                <ul className="mt-7 flex-1 space-y-3.5">
                  {includedEverywhere.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          tier.featured ? "bg-teal/25 text-teal" : "bg-teal/15 text-teal"
                        }`}
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className={tier.featured ? "text-bodygray/90" : "text-navy/70"}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <TrialSignUpButton
                  variant={tier.featured ? "teal" : "ghost"}
                  size="lg"
                  className="mt-8 w-full"
                >
                  Start Free Trial
                </TrialSignUpButton>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={150}>
          <p className="mt-10 text-center text-sm text-navy/50">
            Every plan is the full product — free 30-day trial, no credit card, cancel anytime.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
