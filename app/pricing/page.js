import PageHero from "@/components/PageHero";
import Pricing from "@/components/Pricing";
import ROISection from "@/components/ROISection";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import TrialSignUpButton from "@/components/TrialSignUpButton";
import { ArrowRightIcon } from "@/components/icons";

export const metadata = {
  title: "Pricing — Atlas",
  description:
    "One product, volume pricing. Every plan includes all of Atlas — $15/unit under 50 units, $10/unit to 300, $6/unit beyond. Free 30-day trial, no credit card.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Pay for what you manage. Nothing more."
        subtitle="Per-unit pricing that scales with your portfolio. Start free for 30 days — no credit card, no long-term contract."
      >
        <TrialSignUpButton variant="teal" size="lg">
          Start Free Trial <ArrowRightIcon className="h-5 w-5" />
        </TrialSignUpButton>
      </PageHero>

      <Pricing showHeading={false} />
      <ROISection />
      <ComparisonTable />
      <CTABanner />
    </>
  );
}
