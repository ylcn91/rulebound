import { Header } from "@/components/shared/header";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Comparison } from "@/components/marketing/comparison";
import { Features } from "@/components/marketing/features";
import { OpenSource } from "@/components/marketing/open-source";
import { Pricing } from "@/components/marketing/pricing";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/shared/footer";

export default function MarketingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <div className="divider-dots" role="separator" />
        <Problem />
        <div className="divider-dots" role="separator" />
        <HowItWorks />
        <div className="divider-dots" role="separator" />
        <Comparison />
        <div className="divider-dots" role="separator" />
        <Features />
        <div className="divider-dots" role="separator" />
        <OpenSource />
        <div className="divider-dots" role="separator" />
        <Pricing />
        <div className="divider-dots" role="separator" />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
