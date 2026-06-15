import Container from "./Container";
import Reveal from "./Reveal";

// Compact hero used at the top of inner pages (Features, Pricing, About, Demo).
export default function PageHero({ eyebrow, title, subtitle, children }) {
  return (
    <section className="relative overflow-hidden pt-36 pb-16 lg:pt-44 lg:pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />
      </div>
      <Container className="text-center">
        <Reveal>
          {eyebrow && <span className="eyebrow text-teal">{eyebrow}</span>}
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.08] text-navy sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy/60">{subtitle}</p>
          )}
          {children && <div className="mt-9 flex flex-wrap justify-center gap-4">{children}</div>}
        </Reveal>
      </Container>
    </section>
  );
}
