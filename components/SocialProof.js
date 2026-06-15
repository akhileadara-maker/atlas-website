import Container from "./Container";
import Reveal from "./Reveal";

const stats = [
  { value: "884 hrs", label: "saved per year" },
  { value: "< 1 min", label: "average response time" },
  { value: "4–11×", label: "return on investment" },
  { value: "24/7", label: "tenant coverage" },
];

export default function SocialProof() {
  return (
    <section className="border-y border-navy/10 bg-white py-10">
      <Container>
        <Reveal>
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-navy/45">
            Trusted by property managers across America
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <div className="flex flex-col items-center rounded-2xl border border-navy/10 bg-cream px-4 py-6 text-center">
                <span className="font-serif text-3xl font-bold text-teal lg:text-4xl">
                  {stat.value}
                </span>
                <span className="mt-1.5 text-sm text-navy/55">{stat.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
