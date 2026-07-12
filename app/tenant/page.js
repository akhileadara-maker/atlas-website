import Link from "next/link";
import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/tenantSession";
import { lookupTenant, signOutTenant } from "./actions";
import TenantHome from "@/components/TenantHome";

export const metadata = { title: "Tenant portal — Atlas" };
export const dynamic = "force-dynamic";

// The verified tenant area. No session -> /signin. With a session, route on
// the verified email's leases: none -> contact-manager card; one -> home;
// several -> property picker (?p=<propertyId>, validated server-side).
export default async function TenantPage({ searchParams }) {
  const session = await readTenantSession();
  if (!session) redirect("/signin");

  const res = await lookupTenant(session.email);
  if (res.error) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
            <p className="text-navy/70">{res.error}</p>
          </div>
        </div>
      </section>
    );
  }

  const leases = res.leases;

  // No lease on file for this verified email.
  if (leases.length === 0) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center">
            <p className="font-semibold text-navy">
              We couldn&apos;t find a lease for that email — contact your property manager.
            </p>
            <p className="mt-1 text-sm text-navy/55">
              You verified <span className="font-semibold text-navy">{session.email}</span>. If your
              landlord has a different email on file, sign in with that one.
            </p>
            <form action={signOutTenant} className="mt-4">
              <button className="text-sm font-semibold text-teal hover:text-teal-600">Switch email</button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // Distinct properties this tenant has leases at.
  const properties = [];
  const seen = new Set();
  for (const l of leases) {
    if (!seen.has(l.propertyId)) {
      seen.add(l.propertyId);
      properties.push({ id: l.propertyId, name: l.propertyName, address: l.propertyAddress });
    }
  }

  const sp = (await searchParams) || {};
  const picked = (sp.p || "").toString();
  const validPick = properties.find((p) => p.id === picked)?.id || null;
  const selectedPropertyId = properties.length === 1 ? properties[0].id : validPick;

  // Several properties, none picked yet -> picker.
  if (!selectedPropertyId) {
    return (
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <span className="eyebrow text-teal">Tenant portal</span>
          <h1 className="mt-2 font-serif text-4xl font-bold text-navy">Which property?</h1>
          <p className="mt-2 text-navy/60">
            Signed in as <span className="font-semibold text-navy">{session.email}</span>
          </p>
          <div className="mt-8 space-y-4">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/tenant?p=${p.id}`}
                className="block rounded-3xl border border-navy/10 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-teal/40"
              >
                <h2 className="font-serif text-2xl font-bold text-navy">{p.name}</h2>
                {p.address && <p className="mt-1 text-navy/60">{p.address}</p>}
              </Link>
            ))}
          </div>
          <form action={signOutTenant} className="mt-6">
            <button className="text-sm font-medium text-teal hover:text-teal-600">Switch email</button>
          </form>
        </div>
      </section>
    );
  }

  // The most relevant lease at the selected property (latest lease_end).
  const propertyLeases = leases.filter((l) => l.propertyId === selectedPropertyId);
  const lease = propertyLeases[propertyLeases.length - 1];

  return (
    <section className="min-h-screen bg-cream pt-32 pb-20">
      <div className="mx-auto w-full max-w-3xl px-6">
        <TenantHome
          email={session.email}
          lease={lease}
          propertyId={selectedPropertyId}
          multiProperty={properties.length > 1}
        />
      </div>
    </section>
  );
}
