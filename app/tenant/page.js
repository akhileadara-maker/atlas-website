import Container from "@/components/Container";
import TenantPortal from "@/components/TenantPortal";

export const metadata = {
  title: "Tenant Portal — Atlas",
  description: "Look up your lease and submit maintenance requests.",
};

export default function TenantPage() {
  return (
    <section className="min-h-screen bg-cream pt-32 pb-20">
      <Container>
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <span className="eyebrow text-teal">Tenant portal</span>
            <h1 className="mt-3 text-4xl font-bold text-navy sm:text-5xl">Manage your tenancy</h1>
            <p className="mt-4 text-lg text-navy/60">
              Enter your email to view your lease and submit maintenance requests — no account needed.
            </p>
          </div>
          <div className="mt-10">
            <TenantPortal />
          </div>
        </div>
      </Container>
    </section>
  );
}
