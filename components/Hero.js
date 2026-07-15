import Container from "./Container";
import Button from "./Button";
import TrialSignUpButton from "./TrialSignUpButton";
import Reveal from "./Reveal";
import ChatMockup from "./ChatMockup";
import { ArrowRightIcon, PlayIcon } from "./icons";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
      {/* Soft ambient background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Copy */}
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal/25 bg-teal/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Property operations, automated
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-navy sm:text-5xl lg:text-6xl">
                Property operations,
                <br />
                <span className="text-teal">automated.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-navy/65">
                Atlas answers your tenants, tracks every lease, and handles maintenance —
                automatically, 24/7. Modern tools for the people who keep America housed.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <TrialSignUpButton variant="teal" size="lg">
                  Start Free Trial
                  <ArrowRightIcon className="h-5 w-5" />
                </TrialSignUpButton>
                <Button href="/demo" variant="ghost" size="lg">
                  <PlayIcon className="h-4 w-4" />
                  Watch Demo
                </Button>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-7 text-sm text-navy/45">
                Free 30-day trial · No credit card · Setup takes an afternoon.
              </p>
            </Reveal>
          </div>

          {/* Floating mockup */}
          <Reveal delay={200} className="relative flex justify-center lg:justify-end">
            <div className="absolute inset-0 -z-10 translate-x-6 translate-y-6 rounded-3xl bg-navy/5" />
            <div className="animate-float">
              <ChatMockup />
            </div>
            {/* Little floating stat badge */}
            <div className="absolute -left-4 bottom-6 hidden rounded-2xl border border-navy/10 bg-white px-4 py-3 shadow-xl sm:block">
              <p className="font-serif text-2xl font-bold text-teal">&lt; 1 min</p>
              <p className="text-xs text-navy/55">avg. response time</p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
