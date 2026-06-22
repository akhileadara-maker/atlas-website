import Link from "next/link";
import { CheckIcon } from "./icons";

// Presentational onboarding checklist. `steps` is an array of
// { label, done, href }. Renders nothing once every step is done.
export default function OnboardingChecklist({ steps }) {
  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null; // all done → hide entirely

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-3xl border border-navy/10 bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow text-gold">Getting started</span>
          <h2 className="mt-2 font-serif text-2xl font-bold text-navy">Finish setting up Atlas</h2>
        </div>
        <span className="text-sm font-semibold text-navy/60">
          {completed} of {steps.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-navy/10">
        <div className="h-full rounded-full bg-teal transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Steps */}
      <ol className="mt-6 space-y-1.5">
        {steps.map((step, i) => {
          const row = (
            <div
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors ${
                !step.done && step.href ? "hover:bg-cream" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-teal text-white" : "border-2 border-navy/15 text-navy/35"
                }`}
              >
                {step.done ? <CheckIcon className="h-4 w-4" /> : <span className="text-sm font-semibold">{i + 1}</span>}
              </span>
              <span
                className={`flex-1 text-sm font-medium ${step.done ? "text-navy/40 line-through" : "text-navy"}`}
              >
                {step.label}
              </span>
              {!step.done && step.href && (
                <span className="text-sm font-semibold text-teal">Do this →</span>
              )}
            </div>
          );

          if (step.done || !step.href) {
            return <li key={i}>{row}</li>;
          }
          // In-page anchors use a plain <a>; route links use next/link.
          return (
            <li key={i}>
              {step.href.startsWith("#") ? (
                <a href={step.href} className="block">
                  {row}
                </a>
              ) : (
                <Link href={step.href} className="block">
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
