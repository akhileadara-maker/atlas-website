import Container from "./Container";
import Reveal from "./Reveal";
import Button from "./Button";
import { ArrowRightIcon } from "./icons";

export default function CTABanner() {
  return (
    <section className="py-20 lg:py-28">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-navy px-8 py-16 text-center lg:px-16 lg:py-20">
            {/* Ambient accents */}
            <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-teal/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight text-cream sm:text-4xl lg:text-5xl">
                Property management has been broken for 50 years.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-bodygray/75">
                Start your free 30-day trial today. Setup takes an afternoon — no long-term contract,
                no credit card.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Button href="/demo#trial" variant="gold" size="lg">
                  Start Free Trial
                  <ArrowRightIcon className="h-5 w-5" />
                </Button>
                <Button href="/demo" variant="ghostLight" size="lg">
                  Watch the Demo
                </Button>
              </div>
              <p className="mt-6 text-sm text-bodygray/50">
                hello@atlas.com · atlas.com · (555) 555-0100
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
