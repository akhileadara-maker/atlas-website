import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import CTABanner from "@/components/CTABanner";

export const metadata = {
  title: "About — Atlas",
  description:
    "We spent two years in the field with landlords and property managers. Then we built the platform they actually needed.",
};

const stats = [
  { value: "20M", label: "rental units in the U.S. alone" },
  { value: "~280K", label: "mid-portfolio management firms" },
  { value: "75+ yrs", label: "combined team experience" },
];

const team = [
  { name: "Co-founder", role: "CEO", bio: "15 years in real estate operations. Managed mixed portfolios across three states." },
  { name: "Co-founder", role: "CTO", bio: "ML systems and document AI. Ex-Microsoft Azure Document Intelligence team." },
  { name: "VP Product", role: "Product", bio: "Designed CRM workflows for property managers at a top proptech SaaS." },
  { name: "VP Engineering", role: "Engineering", bio: "Built workflow automation platforms for B2B SaaS. Logic Apps specialist." },
  { name: "Head of Sales", role: "Sales", bio: "20+ years selling SaaS into real estate, with direct mid-portfolio relationships." },
  { name: "Head of Success", role: "Customer Success", bio: "Onboarded 1,000+ B2B SaaS customers. Specializes in non-technical buyers." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Who we are"
        title="Built from two years in the field."
        subtitle="We didn't start with software. We started by listening to the people who keep America housed."
      />

      {/* Story + mission */}
      <section className="pb-12 lg:pb-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
            <Reveal>
              <div className="space-y-5 text-lg leading-relaxed text-navy/70">
                <p>
                  We spent two years with landlords and property managers drowning in repetitive work
                  — the same tenant questions, vendors chased at midnight, renewal deadlines missed.
                  Their tools were built for national REITs or hadn&apos;t changed since the 1990s.
                </p>
                <p>
                  So we built the platform they actually needed: one that handles the busywork, so they
                  can focus on growing the business and serving their tenants. One platform — every
                  property, every tenant, every lease.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-3xl border border-gold/40 bg-navy p-8 text-cream">
                <span className="eyebrow text-gold">Our mission</span>
                <p className="mt-4 font-serif text-2xl font-medium italic leading-snug">
                  Give every property manager their time back — without sacrificing the care their
                  tenants deserve.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
                  <p className="font-serif text-4xl font-bold text-teal lg:text-5xl">{stat.value}</p>
                  <p className="mt-2 text-navy/55">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Team */}
      <section id="team" className="bg-white py-24 lg:py-32">
        <Container>
          <SectionHeading
            eyebrow="The team"
            title="Six people. One conviction."
            subtitle="Property management has been broken for 50 years. We're the team that decided to fix it."
          />
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member, i) => (
              <Reveal key={member.role} delay={(i % 3) * 100}>
                <div className="h-full rounded-3xl border border-navy/10 bg-cream p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-lg font-bold text-white">
                    {member.role.charAt(0)}
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy">{member.name}</h3>
                  <p className="text-sm font-semibold uppercase tracking-wider text-coral">
                    {member.role}
                  </p>
                  <p className="mt-3 text-navy/65">{member.bio}</p>
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
