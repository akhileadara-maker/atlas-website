import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { ShieldIcon, LockIcon, KeyIcon } from "./icons";

const cards = [
  {
    icon: ShieldIcon,
    title: "Never sold or shared",
    body: "Your data is never sold, shared, or used to train any AI model. Microsoft's enterprise terms guarantee it.",
  },
  {
    icon: LockIcon,
    title: "Encrypted & isolated",
    body: "Bank-level encryption in transit and at rest. Each customer's data lives in its own private, walled-off Azure tenant.",
  },
  {
    icon: KeyIcon,
    title: "Sensitive data masked",
    body: "SSNs, birthdates, and bank details are tokenized before the AI ever sees them. Role-based access throughout.",
  },
];

const badges = ["Encryption", "Secure storage", "Access controls", "SOC 2 aligned"];

export default function Security() {
  return (
    <section id="security" className="bg-cream py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="Trusted, proven, ready"
          title="Your data is safer with us."
          subtitle="Built secure from the first line of code — the same security model as Microsoft 365 for enterprise."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.title} delay={i * 120}>
                <div className="flex h-full flex-col rounded-3xl border border-navy/10 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 text-teal">
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="mt-6 text-xl font-bold text-navy">{card.title}</h3>
                  <p className="mt-3 leading-relaxed text-navy/65">{card.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={150}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-3 text-sm font-medium text-teal-600">
            {badges.map((badge, i) => (
              <span key={badge} className="flex items-center gap-3">
                {i > 0 && <span className="text-navy/25">·</span>}
                {badge}
              </span>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
