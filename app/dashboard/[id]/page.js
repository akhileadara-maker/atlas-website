import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Container from "@/components/Container";
import EditPropertyForm from "@/components/EditPropertyForm";
import DeletePropertyButton from "@/components/DeletePropertyButton";
import KnowledgeBaseEditor from "@/components/KnowledgeBaseEditor";
import ChatWidget from "@/components/ChatWidget";
import LeaseIntelligence from "@/components/LeaseIntelligence";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Property — Atlas" };
export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }) {
  const { id } = await params;
  const { userId } = await auth();
  const supabase = getSupabase();
  if (!supabase) notFound();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !property) notFound();

  const hasAgent = Boolean(property.retell_agent_id);

  // Leases for this property (the table won't exist until migration 0006 is run).
  const { data: leases, error: leasesError } = await supabase
    .from("leases")
    .select("*")
    .eq("property_id", id)
    .eq("user_id", userId)
    .order("lease_end", { ascending: true });

  return (
    <section className="min-h-screen bg-cream pt-28 pb-20">
      <Container>
        <Link href="/dashboard" className="text-sm font-medium text-navy/55 transition-colors hover:text-teal">
          ← Back to dashboard
        </Link>

        {/* Header card: name/address/units + edit + delete + test agent */}
        <div className="mt-5 rounded-3xl border border-navy/10 bg-white p-7">
          <EditPropertyForm property={property} />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-navy/10 pt-6">
            {hasAgent ? (
              <a
                href={`https://dashboard.retellai.com/agents/${property.retell_agent_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-teal/30 bg-teal/10 px-5 py-2.5 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal/20"
              >
                Open agent in Retell ↗
              </a>
            ) : (
              <span className="rounded-full border border-navy/10 px-5 py-2.5 text-sm font-medium text-navy/40">
                Agent pending
              </span>
            )}
            <DeletePropertyButton id={property.id} />
          </div>
        </div>

        {/* KB editor + chat widget */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-navy/10 bg-white p-7">
            <h2 className="text-xl font-bold text-navy">Knowledge base</h2>
            <p className="mt-1 text-sm text-navy/55">
              Fill in your property&apos;s details. When you save, your AI agent learns them and can
              answer tenants automatically.
            </p>
            <div className="mt-6">
              <KnowledgeBaseEditor propertyId={property.id} initial={property.kb_data} hasAgent={hasAgent} />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy">Test your agent</h2>
            <p className="mt-1 text-sm text-navy/55">Chat live with this property&apos;s agent.</p>
            <div className="mt-6">
              <ChatWidget propertyId={property.id} hasAgent={hasAgent} />
            </div>
          </div>
        </div>

        {/* Lease Intelligence */}
        <div className="mt-8">
          <LeaseIntelligence
            propertyId={property.id}
            leases={leases || []}
            tableMissing={Boolean(leasesError)}
          />
        </div>
      </Container>
    </section>
  );
}
