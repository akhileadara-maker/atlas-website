import PageHero from "@/components/PageHero";
import Pricing from "@/components/Pricing";
import ROISection from "@/components/ROISection";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import Button from "@/components/Button";
import { ArrowRightIcon } from "@/components/icons";

export const metadata = {
  title: "Pricing — Atlas",
  description:
    "Simple, per-unit pricing. Dispatch at $6/unit, Lease Intelligence at $10/unit, or the Full Platform at $15/unit. Free 30-day trial, no credit card.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Pay for what you manage. Nothing more."
        subtitle="Per-unit pricing that scales with your portfolio. Start free for 30 days — no credit card, no long-term contract."
      >
        <Button href="/demo#trial" variant="teal" size="lg">
          Start Free Trial <ArrowRightIcon className="h-5 w-5" />
        </Button>
      </PageHero>

      <Pricing showHeading={false} />
      <ROISection />
      <ComparisonTable />
      <CTABanner />
    </>
  );
}
