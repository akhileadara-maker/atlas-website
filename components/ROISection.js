import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const scenarios = [
  {
    label: "Conservative",
    value: "$24K",
    period: "/ year",
    detail: "4× return · pays back in 3 months",
    featured: false,
  },
  {
    label: "Expected",
    value: "$47.5K",
    period: "/ year",
    detail: "8× return · pays back in 6 weeks",
    featured: true,
  },
  {
    label: "Best case",
    value: "$70K+",
    period: "/ year",
    detail: "11×+ return · pays back in 1 month",
    featured: false,
  },
];

export default function ROISection() {
  return (
    <section className="bg-navy py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="Priced on value, built for ROI"
          eyebrowColor="text-gold"
          title="Even the worst case wins."
          subtitle="For a 50-unit manager paying about $6,000 a year for Atlas, the math works out three ways — and every one of them comes out ahead."
          light
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {scenarios.map((s, i) => (
            <Reveal key={s.label} delay={i * 120}>
              <div
                className={`flex h-full flex-col items-center rounded-3xl p-8 text-center transition-all duration-300 hover:-translate-y-2 ${
                  s.featured
                    ? "border-2 border-gold bg-navy-700 shadow-2xl shadow-black/30"
                    : "border border-white/10 bg-navy-600/40"
                }`}
              >
                {s.featured && (
                  <span className="mb-4 rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">
                    Most likely
                  </span>
                )}
                <span className={`eyebrow ${s.featured ? "text-gold" : "text-teal"}`}>{s.label}</span>
                <p className="mt-4 font-serif text-5xl font-bold text-cream">
                  {s.value}
                  <span className="ml-1 text-lg font-medium text-bodygray/50">{s.period}</span>
                </p>
                <p className="mt-4 text-sm text-bodygray/70">{s.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={150}>
          <p className="mt-12 text-center text-bodygray/60">
            Faster service keeps tenants longer — and longer tenancies are the single biggest driver
            of your profit.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
