import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ChatMockup from "@/components/ChatMockup";
import TrialForm from "@/components/TrialForm";
import FAQ from "@/components/FAQ";
import { MicIcon, CheckIcon } from "@/components/icons";

export const metadata = {
  title: "Demo — Atlas",
  description:
    "See Atlas in action. Watch a real tenant request flow from question to resolution — then start your free 30-day trial.",
};

const watchFor = [
  "How fast it responds",
  "How naturally it understands the request",
  "What it does next — not just talk, but act",
];

const beforeAfter = [
  { time: "8:14 AM", before: "Tenant asks lease end date — again.", after: "Atlas answers in 2 seconds. You never see it." },
  { time: "10:32 AM", before: "HVAC breaks at the strip mall.", after: "Atlas dispatches the on-call vendor. Tenant gets an ETA." },
  { time: "1:45 PM", before: "Renewal notice due for Apt 7B.", after: "Atlas already sent it — flagged 60 days ago." },
  { time: "11:47 PM", before: "A faucet won't stop in 4B.", after: "Atlas dispatches the 24/7 plumber. You sleep." },
];

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="See it for yourself"
        title="Talk to Atlas. It answers back."
        subtitle="A tenant has a real problem and reaches out — exactly like yours do every day. Here's how Atlas responds in real time, with no human involved."
      />

      {/* Scenario + live demo */}
      <section className="pb-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <div className="rounded-3xl border border-navy/10 bg-white p-8">
                <span className="eyebrow text-coral">The scenario</span>
                <p className="mt-4 text-lg leading-relaxed text-navy/70">
                  It&apos;s 11:47 PM. A faucet won&apos;t stop running in apartment 4B. The landlord is
                  asleep, the maintenance guy isn&apos;t picking up, and the tenant is panicking.
                </p>
                <p className="mt-6 font-semibold text-navy">Watch for three things:</p>
                <ul className="mt-4 space-y-3">
                  {watchFor.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-navy/70">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                        <CheckIcon className="h-3.5 w-3.5" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120} className="flex justify-center">
              <ChatMockup />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Before / after timeline */}
      <section className="bg-navy py-24 lg:py-32">
        <Container>
          <Reveal className="text-center">
            <span className="eyebrow text-gold">A day in the life with Atlas</span>
            <h2 className="mt-4 text-3xl font-bold text-cream sm:text-4xl">
              The same Tuesday. Without the chaos.
            </h2>
          </Reveal>

          <div className="mx-auto mt-14 max-w-4xl space-y-4">
            {beforeAfter.map((row, i) => (
              <Reveal key={row.time} delay={i * 80}>
                <div className="grid items-center gap-4 rounded-2xl border border-white/10 bg-navy-600/40 p-5 sm:grid-cols-[auto_1fr_1fr]">
                  <span className="rounded-lg border border-gold/40 px-3 py-1 text-center text-sm font-semibold text-gold">
                    {row.time}
                  </span>
                  <span className="text-bodygray/60">{row.before}</span>
                  <span className="flex items-center gap-2 font-medium text-teal">
                    <span className="text-bodygray/40">→</span> {row.after}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Trial signup */}
      <section id="trial" className="scroll-mt-24 py-24 lg:py-32">
        <Container className="max-w-2xl text-center">
          <Reveal>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/12 text-teal">
              <MicIcon className="h-8 w-8" />
            </span>
            <h2 className="mt-6 text-3xl font-bold text-navy sm:text-4xl">
              Start your free 30-day trial.
            </h2>
            <p className="mt-4 text-lg text-navy/60">
              Speak to Atlas. It answers back. Real product — not a video.
            </p>
            <div className="mt-9">
              <TrialForm />
            </div>
          </Reveal>
        </Container>
      </section>

      <FAQ />
    </>
  );
}
