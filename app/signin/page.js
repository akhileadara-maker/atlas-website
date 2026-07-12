import { SignInButton } from "@clerk/nextjs";
import TenantSignIn from "@/components/TenantSignIn";

export const metadata = { title: "Sign in — Atlas" };

const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:bg-teal-600";

// The unified front door: landlords keep the existing Clerk modal; tenants
// verify with an emailed one-time code.
export default function SignInPage() {
  return (
    <section className="min-h-screen bg-cream pt-32 pb-20">
      <div className="mx-auto w-full max-w-4xl px-6">
        <span className="eyebrow text-teal">Sign in</span>
        <h1 className="mt-2 font-serif text-4xl font-bold text-navy">Welcome back.</h1>
        <p className="mt-2 text-navy/60">Choose how you use Atlas.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Landlord */}
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="font-serif text-2xl font-bold text-navy">I&apos;m a landlord</h2>
            <p className="mt-1 text-sm text-navy/55">
              Manage your properties, leases, and AI agents.
            </p>
            <div className="mt-6">
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className={tealBtn}>Log in to your dashboard</button>
              </SignInButton>
            </div>
          </div>

          {/* Tenant */}
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="font-serif text-2xl font-bold text-navy">I&apos;m a tenant</h2>
            <p className="mt-1 text-sm text-navy/55">
              Chat with your property assistant, see your lease, and submit requests.
            </p>
            <div className="mt-6">
              <TenantSignIn />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
