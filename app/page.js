import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import PainSection from "@/components/PainSection";
import SolutionSection from "@/components/SolutionSection";
import HowItWorks from "@/components/HowItWorks";
import ROISection from "@/components/ROISection";
import ComparisonTable from "@/components/ComparisonTable";
import Pricing from "@/components/Pricing";
import Security from "@/components/Security";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <PainSection />
      <SolutionSection />
      <HowItWorks />
      <ROISection />
      <ComparisonTable />
      <Pricing />
      <Security />
      <FAQ />
      <CTABanner />
    </>
  );
}
