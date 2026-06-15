import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const steps = [
  { n: "1", title: "Tenant reaches out", body: "By voice or text, in their own words — any hour, any language." },
  { n: "2", title: "Atlas understands", body: "It identifies the real issue and how urgent it is." },
  { n: "3", title: "It responds instantly", body: "The tenant feels heard — in seconds, not hours." },
  { n: "4", title: "It takes action", body: "Logs the issue and routes it to the right vendor automatically." },
  { n: "5", title: "Everyone's updated", body: "The tenant gets status; you get a clean summary." },
  { n: "6", title: "You stayed focused", body: "You never had to stop what you were doing." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="What just happened"
          title="One request. Six steps. Zero work from you."
          subtitle="A single tenant message flows from question to resolution — without you lifting a finger."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={(i % 3) * 100}>
              <div className="group relative h-full overflow-hidden rounded-3xl border border-navy/10 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/5">
                {/* Big ghost number */}
                <span className="pointer-events-none absolute -right-2 -top-4 font-serif text-7xl font-bold text-navy/[0.04] transition-colors group-hover:text-teal/10">
                  {step.n}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/20 font-serif text-lg font-bold text-gold">
                  {step.n}
                </span>
                <h3 className="mt-5 text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 text-navy/60">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
