import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Container from "@/components/Container";
import {
  ChatIcon,
  WrenchIcon,
  DocumentIcon,
  ClockIcon,
  CheckIcon,
} from "@/components/icons";

export const metadata = {
  title: "Dashboard — Atlas",
};

const stats = [
  { icon: DocumentIcon, label: "Units managed", value: "128" },
  { icon: WrenchIcon, label: "Open maintenance", value: "3" },
  { icon: ClockIcon, label: "Renewals due (90d)", value: "7" },
  { icon: ChatIcon, label: "Tenant chats today", value: "42" },
];

const activity = [
  { time: "2m ago", text: "Atlas dispatched a plumber to Apt 4B (urgent)." },
  { time: "1h ago", text: "Lease for Apt 7B flagged — renewal due in 88 days." },
  { time: "3h ago", text: "Answered 6 tenant questions in 3 languages." },
  { time: "Today", text: "Rent escalation +3% applied to Strip Mall · Unit 3." },
];

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName || "there";
  const email = user?.emailAddresses?.[0]?.emailAddress;

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

        {/* Stats */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-3xl border border-navy/10 bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/12 text-teal">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-serif text-3xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-sm text-navy/55">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Two-column body */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Activity feed */}
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="text-xl font-bold text-navy">Recent activity</h2>
            <ul className="mt-5 space-y-4">
              {activity.map((item, i) => (
                <li key={i} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-navy/80">{item.text}</p>
                    <p className="text-xs text-navy/40">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Get started card */}
          <div className="rounded-3xl bg-navy p-7 text-cream">
            <span className="eyebrow text-gold">Getting started</span>
            <h2 className="mt-3 font-serif text-2xl font-bold">Your trial is active</h2>
            <p className="mt-2 text-bodygray/70">
              This is a placeholder dashboard. Connect your properties and leases to bring it to life.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Import your leases", "Invite your team", "Connect your vendors"].map((step) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal/30 text-teal">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-bodygray/85">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
