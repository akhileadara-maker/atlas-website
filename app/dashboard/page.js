import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Container from "@/components/Container";
import AddProperty from "@/components/AddProperty";
import { getSupabase } from "@/lib/supabase";
import { getSubscription, isActive } from "@/lib/subscription";
import { PLANS } from "@/lib/plans";
import { DocumentIcon, WrenchIcon, ClockIcon } from "@/components/icons";
import OnboardingChecklist from "@/components/OnboardingChecklist";

export const metadata = { title: "Dashboard — Atlas" };

// Always render fresh data (this page reads per-user rows from Supabase).
export const dynamic = "force-dynamic";

function fmtDate(value) {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// True if a property's knowledge-base form has any real content entered.
function hasKbContent(kb) {
  if (!kb || typeof kb !== "object") return false;
  return Object.entries(kb).some(([key, value]) => {
    if (key === "pet_allowed") return value === "yes";
    return typeof value === "string" ? value.trim() !== "" : value != null;
  });
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const firstName = user?.firstName || "there";
  const email = user?.emailAddresses?.[0]?.emailAddress;

  // Lazily get the client — null if env vars aren't configured (e.g. on a
  // fresh deploy before the vars are added). We render a friendly notice
  // instead of crashing the page.
  const supabase = getSupabase();
  const configured = Boolean(supabase);

  let properties = [];
  let dbError = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) dbError = error.message;
    else properties = data || [];
  }

  const totalUnits = properties.reduce((sum, p) => sum + (p.units || 0), 0);
  const avgUnits = properties.length ? Math.round(totalUnits / properties.length) : 0;

  const sub = await getSubscription(userId);
  const activePlan = isActive(sub) && sub?.plan ? PLANS[sub.plan] : null;

  // Onboarding checklist steps (the component hides itself once all are done).
  const firstPropertyId = properties[0]?.id;
  const onboardingSteps = [
    { label: "Create your account", done: true, href: null },
    { label: "Add your first property", done: properties.length > 0, href: "#properties" },
    {
      label: "Set up your knowledge base",
      done: properties.some((p) => hasKbContent(p.kb_data)),
      href: firstPropertyId ? `/dashboard/${firstPropertyId}` : "#properties",
    },
    {
      label: "Test your AI agent",
      done: properties.some((p) => p.retell_agent_id),
      href: firstPropertyId ? `/dashboard/${firstPropertyId}` : "#properties",
    },
    { label: "Choose a plan", done: isActive(sub), href: "/dashboard/billing" },
  ];

  const stats = [
    { icon: DocumentIcon, label: "Properties", value: properties.length },
    { icon: WrenchIcon, label: "Total units", value: totalUnits },
    { icon: ClockIcon, label: "Avg units / property", value: avgUnits },
  ];

  return (
    <section className="min-h-screen bg-cream pt-28 pb-20">
      <Container>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="eyebrow text-teal">Your workspace</span>
            <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            {email && <p className="mt-1 text-navy/55">Signed in as {email}</p>}
            <div className="mt-3 flex items-center gap-3">
              {activePlan ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/12 px-3 py-1 text-sm font-semibold text-teal-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" /> {activePlan.name} plan · active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-navy/5 px-3 py-1 text-sm font-medium text-navy/55">
                  No active plan
                </span>
              )}
              <Link href="/dashboard/billing" className="text-sm font-medium text-teal transition-colors hover:text-teal-600">
                Billing →
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-navy/10 bg-white px-4 py-2">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm font-medium text-navy/70">Account</span>
          </div>
        </div>

        {/* Onboarding checklist — hides itself once all 5 steps are complete */}
        <div className="mt-8">
          <OnboardingChecklist steps={onboardingSteps} />
        </div>

        {/* Stats (derived from your real data) */}
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-3xl border border-navy/10 bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/12 text-teal">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-serif text-3xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-sm text-navy/55">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Properties */}
        <div id="properties" className="mt-10 scroll-mt-28 rounded-3xl border border-navy/10 bg-white p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-navy">Your properties</h2>
              <p className="text-sm text-navy/55">Everything Atlas manages for you, in one place.</p>
            </div>
            {configured && <AddProperty />}
          </div>

          {/* Supabase not configured (missing env vars) */}
          {!configured && (
            <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm text-navy/70">
              <p className="font-semibold text-navy">Database not configured.</p>
              <p className="mt-1">
                Add <code className="rounded bg-navy/5 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-navy/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to your
                environment variables (locally in <code className="rounded bg-navy/5 px-1">.env.local</code>,
                and in Vercel → Settings → Environment Variables), then redeploy.
              </p>
            </div>
          )}

          {/* DB error (e.g., the migration hasn't been run yet) */}
          {configured && dbError && (
            <div className="mt-6 rounded-2xl border border-coral/30 bg-coral/5 p-5 text-sm text-navy/70">
              <p className="font-semibold text-coral">Couldn&apos;t load properties.</p>
              <p className="mt-1">
                Make sure the <code className="rounded bg-navy/5 px-1">properties</code> table exists.
                ({dbError})
              </p>
            </div>
          )}

          {/* Empty state */}
          {configured && !dbError && properties.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-cream p-10 text-center">
              <p className="font-medium text-navy">No properties yet.</p>
              <p className="mt-1 text-sm text-navy/55">
                Click <span className="font-semibold text-teal">Add Property</span> to add your first one.
              </p>
            </div>
          )}

          {/* List */}
          {configured && properties.length > 0 && (
            <ul className="mt-6 divide-y divide-navy/10">
              {properties.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/${p.id}`}
                      className="truncate font-semibold text-navy transition-colors hover:text-teal"
                    >
                      {p.name}
                    </Link>
                    {p.address && <p className="truncate text-sm text-navy/55">{p.address}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-right">
                    <div>
                      <p className="font-serif text-lg font-bold text-teal">{p.units}</p>
                      <p className="text-xs text-navy/45">units</p>
                    </div>
                    <p className="hidden text-xs text-navy/40 lg:block">Added {fmtDate(p.created_at)}</p>
                    {p.retell_agent_id ? (
                      <a
                        href={`https://dashboard.retellai.com/agents/${p.retell_agent_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal/20"
                      >
                        Test Agent
                      </a>
                    ) : (
                      <span className="rounded-full border border-navy/10 px-4 py-2 text-xs font-medium text-navy/40">
                        Agent pending
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
