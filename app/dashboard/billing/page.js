import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import Container from "@/components/Container";
import SubscribeButton from "@/components/SubscribeButton";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { getSubscription, getUnitCount, isActive } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata = { title: "Billing — Atlas" };
export const dynamic = "force-dynamic";

function fmtDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

export default async function BillingPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const { userId } = await auth();

  const [units, sub] = await Promise.all([getUnitCount(userId), getSubscription(userId)]);
  const billedUnits = Math.max(1, units);
  const active = isActive(sub);
  const activePlan = active && sub?.plan ? PLANS[sub.plan] : null;
  const configured = isStripeConfigured();

  return (
    <section className="min-h-screen bg-cream pt-28 pb-20">
      <Container>
        <Link href="/dashboard" className="text-sm font-medium text-navy/55 transition-colors hover:text-teal">
          ← Back to dashboard
        </Link>

        <div className="mt-5">
          <span className="eyebrow text-teal">Billing</span>
          <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">Plans &amp; billing</h1>
          <p className="mt-1 text-navy/60">
            Atlas is priced per unit, per month. You currently manage{" "}
            <span className="font-semibold text-navy">{units} unit{units === 1 ? "" : "s"}</span>.
          </p>
        </div>

        {/* Checkout result banners */}
        {sp.success && (
          <div className="mt-6 rounded-2xl border border-teal/30 bg-teal/10 p-5 text-sm text-navy/75">
            <span className="font-semibold text-teal-600">✓ Payment received.</span> Your plan will
            activate within a few seconds (once Stripe confirms). Refresh if it&apos;s not shown yet.
          </div>
        )}
        {sp.canceled && (
          <div className="mt-6 rounded-2xl border border-navy/15 bg-white p-5 text-sm text-navy/70">
            Checkout canceled — no charge was made.
          </div>
        )}

        {!configured && (
          <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm text-navy/70">
            <p className="font-semibold text-navy">Billing isn&apos;t configured.</p>
            <p className="mt-1">Add <code className="rounded bg-navy/5 px-1">STRIPE_SECRET_KEY</code> to your environment, then redeploy.</p>
          </div>
        )}

        {/* Current plan */}
        <div className="mt-8 rounded-3xl border border-navy/10 bg-white p-7">
          <h2 className="text-lg font-bold text-navy">Current plan</h2>
          {activePlan ? (
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-serif text-3xl font-bold text-navy">{activePlan.name}</p>
                <p className="mt-1 text-sm text-navy/60">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/12 px-2.5 py-0.5 font-semibold text-teal-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal" /> {sub.status}
                  </span>
                  {fmtDate(sub.current_period_end) && (
                    <span className="ml-3 text-navy/45">Renews {fmtDate(sub.current_period_end)}</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif text-3xl font-bold text-teal">
                  ${(sub.units || billedUnits) * activePlan.unitPrice}
                  <span className="text-base font-medium text-navy/45">/mo</span>
                </p>
                <p className="text-sm text-navy/55">
                  {sub.units || billedUnits} units × ${activePlan.unitPrice}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-navy/60">No active plan yet — choose one below to get started.</p>
          )}
        </div>

        {/* Plan options */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key];
            const isCurrent = activePlan?.key === key;
            const monthly = billedUnits * plan.unitPrice;
            return (
              <div
                key={key}
                className={`flex flex-col rounded-3xl p-7 transition-all ${
                  isCurrent ? "bg-navy text-cream ring-2 ring-teal" : "border border-navy/10 bg-white"
                }`}
              >
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${isCurrent ? "text-gold" : "text-teal"}`}>
                  {plan.name}
                </h3>
                <p className="mt-3 font-serif text-4xl font-bold">
                  ${plan.unitPrice}
                  <span className={`text-base font-medium ${isCurrent ? "text-bodygray/60" : "text-navy/45"}`}>
                    /unit/mo
                  </span>
                </p>
                <p className={`mt-2 text-sm ${isCurrent ? "text-bodygray/75" : "text-navy/60"}`}>{plan.tagline}</p>
                <p className={`mt-4 text-sm ${isCurrent ? "text-bodygray/85" : "text-navy/70"}`}>
                  Your {billedUnits} unit{billedUnits === 1 ? "" : "s"} ={" "}
                  <span className={`font-bold ${isCurrent ? "text-cream" : "text-navy"}`}>${monthly}/mo</span>
                </p>
                <div className="mt-auto pt-6">
                  <SubscribeButton
                    planKey={key}
                    label={isCurrent ? "Current plan" : activePlan ? "Switch to this plan" : "Subscribe"}
                    disabled={isCurrent || !configured}
                    className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
                      isCurrent
                        ? "bg-cream/15 text-cream"
                        : "bg-teal text-white shadow-lg shadow-teal/25 hover:-translate-y-0.5 hover:bg-teal-600"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
