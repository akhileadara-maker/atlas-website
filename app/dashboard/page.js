import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Container from "@/components/Container";
import AddProperty from "@/components/AddProperty";
import { supabase } from "@/lib/supabase";
import { DocumentIcon, WrenchIcon, ClockIcon } from "@/components/icons";

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

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  const firstName = user?.firstName || "there";
  const email = user?.emailAddresses?.[0]?.emailAddress;

  // Fetch this landlord's properties (scoped by their Clerk user id).
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const properties = data || [];
  const totalUnits = properties.reduce((sum, p) => sum + (p.units || 0), 0);
  const avgUnits = properties.length ? Math.round(totalUnits / properties.length) : 0;

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
          </div>
          <div className="flex items-center gap-3 rounded-full border border-navy/10 bg-white px-4 py-2">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm font-medium text-navy/70">Account</span>
          </div>
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
        <div className="mt-10 rounded-3xl border border-navy/10 bg-white p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-navy">Your properties</h2>
              <p className="text-sm text-navy/55">Everything Atlas manages for you, in one place.</p>
            </div>
            <AddProperty />
          </div>

          {/* DB error (e.g., the migration hasn't been run yet) */}
          {error && (
            <div className="mt-6 rounded-2xl border border-coral/30 bg-coral/5 p-5 text-sm text-navy/70">
              <p className="font-semibold text-coral">Couldn&apos;t load properties.</p>
              <p className="mt-1">
                Make sure the <code className="rounded bg-navy/5 px-1">properties</code> table exists —
                run <code className="rounded bg-navy/5 px-1">supabase/migrations/0001_create_properties.sql</code>{" "}
                in your Supabase SQL editor. ({error.message})
              </p>
            </div>
          )}

          {/* Empty state */}
          {!error && properties.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-cream p-10 text-center">
              <p className="font-medium text-navy">No properties yet.</p>
              <p className="mt-1 text-sm text-navy/55">
                Click <span className="font-semibold text-teal">Add Property</span> to add your first one.
              </p>
            </div>
          )}

          {/* List */}
          {properties.length > 0 && (
            <ul className="mt-6 divide-y divide-navy/10">
              {properties.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{p.name}</p>
                    {p.address && <p className="truncate text-sm text-navy/55">{p.address}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-right">
                    <div>
                      <p className="font-serif text-lg font-bold text-teal">{p.units}</p>
                      <p className="text-xs text-navy/45">units</p>
                    </div>
                    <p className="hidden text-xs text-navy/40 sm:block">Added {fmtDate(p.created_at)}</p>
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
