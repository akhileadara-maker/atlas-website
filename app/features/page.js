import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import Button from "@/components/Button";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";
import {
  ChatIcon,
  DocumentIcon,
  WrenchIcon,
  MicIcon,
  GlobeIcon,
  ClockIcon,
  CheckIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata = {
  title: "Features — Atlas",
  description:
    "Tenant AI, Lease Intelligence, and Maintenance Dispatch — three jobs that consume 80% of a property manager's time, done automatically.",
};

const features = [
  {
    id: "tenant-ai",
    icon: ChatIcon,
    eyebrow: "Tenant AI",
    title: "A tenant assistant that never sleeps.",
    body: "A 24/7 conversational assistant that answers lease questions, pet policies, rent dates, and building rules instantly — by voice or chat, in any language. Tenants feel heard in seconds; you stay focused.",
    points: [
      { icon: MicIcon, text: "Voice + chat, powered by real-time conversational AI" },
      { icon: GlobeIcon, text: "Speaks your tenants' language — automatically" },
      { icon: ClockIcon, text: "Always on: nights, weekends, holidays" },
    ],
  },
  {
    id: "lease-intelligence",
    icon: DocumentIcon,
    eyebrow: "Lease Intelligence",
    title: "Every lease, understood and remembered.",
    body: "Atlas ingests every lease in your portfolio and structures it — tracking renewal dates, rent escalations, and exit clauses. It flags anything important 90 days early and surfaces any clause in plain English.",
    points: [
      { icon: DocumentIcon, text: "Reads and extracts every lease automatically" },
      { icon: ClockIcon, text: "90-day renewal & escalation alerts" },
      { icon: CheckIcon, text: "Ask a question, get the exact clause back" },
    ],
  },
  {
    id: "dispatch",
    icon: WrenchIcon,
    eyebrow: "Maintenance Dispatch",
    title: "From request to resolved — hands-free.",
    body: "A tenant submits a maintenance issue and Atlas triages urgency, routes it to the right vendor by proximity, notifies the tenant, and tracks the job to completion. You get a clean summary, not a midnight phone call.",
    points: [
      { icon: WrenchIcon, text: "AI urgency triage on every request" },
      { icon: ArrowRightIcon, text: "Auto-routing to the nearest available vendor" },
      { icon: CheckIcon, text: "Tracked to completion, logged automatically" },
    ],
  },
];

// Small illustrative visual that differs per feature.
function FeatureVisual({ id }) {
  if (id === "tenant-ai") {
    return (
      <div className="space-y-3 rounded-3xl border border-navy/10 bg-white p-6 shadow-xl shadow-navy/5">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-cream">
            ¿Cuándo vence mi contrato de arrendamiento?
          </p>
        </div>
        <div className="flex justify-start">
          <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-bodygray px-4 py-2.5 text-sm text-navy">
            Tu contrato vence el 31 de agosto de 2026. ¿Quieres que te ayude a renovarlo?
          </p>
        </div>
        <p className="pt-1 text-center text-xs text-navy/40">Answered in 2 seconds · auto-detected language</p>
      </div>
    );
  }
  if (id === "lease-intelligence") {
    return (
      <div className="space-y-3 rounded-3xl border border-navy/10 bg-white p-6 shadow-xl shadow-navy/5">
        {[
          { unit: "Apt 7B", note: "Renewal due in 88 days", tone: "gold" },
          { unit: "Strip Mall · Unit 3", note: "Rent escalation +3% on Jul 1", tone: "teal" },
          { unit: "Apt 2A", note: "Exit clause: 60-day notice", tone: "navy" },
        ].map((row) => (
          <div
            key={row.unit}
            className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3"
          >
            <span className="text-sm font-semibold text-navy">{row.unit}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                row.tone === "gold"
                  ? "bg-gold/20 text-gold"
                  : row.tone === "teal"
                  ? "bg-teal/15 text-teal-600"
                  : "bg-navy/10 text-navy/70"
              }`}
            >
              {row.note}
            </span>
          </div>
        ))}
        <p className="pt-1 text-center text-xs text-navy/40">Flagged automatically · 90 days ahead</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-6 shadow-xl shadow-navy/5">
      <ol className="space-y-4">
        {[
          "Tenant reports broken HVAC",
          "Triaged as urgent",
          "Nearest vendor dispatched",
          "Tenant notified · ETA sent",
          "Job completed & logged",
        ].map((step, i, arr) => (
          <li key={step} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-xs font-bold text-teal">
              {i + 1}
            </span>
            <span className={`text-sm ${i === arr.length - 1 ? "font-semibold text-teal-600" : "text-navy/70"}`}>
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const azure = [
  { name: "Azure OpenAI", body: "Conversational tenant AI with safety guardrails for multilingual support." },
  { name: "Azure Document Intelligence", body: "Reads, extracts, and structures every lease in the portfolio." },
  { name: "Azure Logic Apps", body: "Automates maintenance dispatch workflows end to end." },
  { name: "Microsoft Teams + Outlook", body: "Property managers get alerts in tools they already use daily." },
  { name: "Azure Maps", body: "Matches vendors to properties by real-time proximity." },
  { name: "Power BI", body: "Portfolio dashboards: vacancy rates, maintenance costs, renewals." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="What Atlas does"
        title="Three jobs. Done automatically. Forever."
        subtitle="The three tasks that consume 80% of every property manager's time — Atlas handles all of them, so you don't have to."
      >
        <Button href="/demo#trial" variant="teal" size="lg">
          Start Free Trial <ArrowRightIcon className="h-5 w-5" />
        </Button>
        <Button href="/pricing" variant="ghost" size="lg">
          See pricing
        </Button>
      </PageHero>

      {/* Alternating deep dives */}
      <div className="space-y-24 py-12 lg:space-y-32 lg:py-20">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          const reversed = i % 2 === 1;
          return (
            <Container key={feature.id}>
              <div
                id={feature.id}
                className="grid items-center gap-12 scroll-mt-28 lg:grid-cols-2"
              >
                <Reveal className={reversed ? "lg:order-2" : ""}>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 text-teal">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="eyebrow mt-6 block text-gold">{feature.eyebrow}</span>
                  <h2 className="mt-3 text-3xl font-bold text-navy sm:text-4xl">{feature.title}</h2>
                  <p className="mt-5 text-lg leading-relaxed text-navy/65">{feature.body}</p>
                  <ul className="mt-7 space-y-4">
                    {feature.points.map((point) => {
                      const PIcon = point.icon;
                      return (
                        <li key={point.text} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-teal">
                            <PIcon className="h-5 w-5" />
                          </span>
                          <span className="text-navy/75">{point.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>

                <Reveal delay={120} className={reversed ? "lg:order-1" : ""}>
                  <FeatureVisual id={feature.id} />
                </Reveal>
              </div>
            </Container>
          );
        })}
      </div>

      {/* Azure stack */}
      <section className="bg-white py-24 lg:py-32">
        <Container>
          <SectionHeading
            eyebrow="Built on Microsoft Azure"
            title="Microsoft-native, end to end."
            subtitle="Atlas is built on enterprise infrastructure your tenants' data can trust — and tools your team already uses."
          />
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {azure.map((item, i) => (
              <Reveal key={item.name} delay={(i % 3) * 100}>
                <div className="h-full rounded-3xl border border-navy/10 bg-cream p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/5">
                  <h3 className="text-lg font-bold text-teal-600">{item.name}</h3>
                  <p className="mt-2 text-navy/65">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <CTABanner />
    </>
  );
}
