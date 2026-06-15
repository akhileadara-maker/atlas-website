import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { ChatIcon, DocumentIcon, WrenchIcon } from "./icons";

const features = [
  {
    icon: ChatIcon,
    title: "It answers",
    body: "A 24/7 conversational assistant. Tenants get instant, accurate answers about rent, leases, policies, and building rules — by chat or voice, in any language.",
  },
  {
    icon: DocumentIcon,
    title: "It remembers",
    body: "Atlas ingests every lease in your portfolio and tracks renewal dates, rent escalations, and exit clauses — flagging anything important 90 days early.",
  },
  {
    icon: WrenchIcon,
    title: "It acts",
    body: "Maintenance requests are triaged by urgency, routed to the right vendor, and tracked to completion — while the tenant is kept updated the whole way.",
  },
];

export default function SolutionSection() {
  return (
    <section id="features" className="bg-white py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="There's a better way"
          title="Meet Atlas."
          subtitle="An AI-powered assistant that answers your tenants, tracks your leases, and handles maintenance — automatically, 24/7."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={i * 120}>
                <div className="group flex h-full flex-col rounded-3xl border border-navy/10 bg-cream p-8 transition-all duration-300 hover:-translate-y-2 hover:border-teal/40 hover:shadow-2xl hover:shadow-navy/5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-6 text-2xl font-bold text-gold">{feature.title}</h3>
                  <p className="mt-3 leading-relaxed text-navy/65">{feature.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
