import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { ChatIcon, WrenchIcon, FileWarningIcon, ClockIcon } from "./icons";

const pains = [
  {
    icon: ChatIcon,
    title: "Endless tenant questions",
    body: "The same rent, lease, and policy questions — by call, text, and email, at all hours of the night.",
  },
  {
    icon: WrenchIcon,
    title: "Missed maintenance requests",
    body: "A small leak slips through the cracks at 11 PM and quietly becomes a $5,000 repair.",
  },
  {
    icon: FileWarningIcon,
    title: "Paperwork & deadlines",
    body: "Leases, renewals, and notices tracked by memory and sticky notes — until one slips.",
  },
  {
    icon: ClockIcon,
    title: "Rising costs, shrinking time",
    body: "Labor climbs every year while your day fills with admin instead of growing the business.",
  },
];

export default function PainSection() {
  return (
    <section className="py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="The cost of the old way"
          eyebrowColor="text-coral"
          title="The work never stops. And it's all on you."
          subtitle="Property management is operational chaos — every day, for 20 million units running on duct tape, Excel, and phone calls."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {pains.map((pain, i) => {
            const Icon = pain.icon;
            return (
              <Reveal key={pain.title} delay={(i % 2) * 100}>
                <div className="group flex h-full gap-5 rounded-3xl border border-navy/10 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-coral/40 hover:shadow-xl hover:shadow-navy/5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-coral/12 text-coral">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-navy">{pain.title}</h3>
                    <p className="mt-2 leading-relaxed text-navy/60">{pain.body}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={150}>
          <p className="mt-12 text-center text-lg font-medium italic text-navy/70">
            ≈ <span className="font-bold not-italic text-coral">$36,000 a year</span> leaks from a
            mid-size operation. This isn&apos;t an off day — it&apos;s every day.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
