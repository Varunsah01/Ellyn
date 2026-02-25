import { Navigation } from "@/components/landing/Navigation";
import { Hero } from "@/components/landing/Hero";
import { UseCases } from "@/components/landing/UseCases";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TrustAndCompliance } from "@/components/landing/TrustAndCompliance";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { About } from "@/components/landing/About";
import { FAQ } from "@/components/landing/Faq";
import { FinalCTA } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <Hero />
      <UseCases />
      <Features />
      <HowItWorks />
      <TrustAndCompliance />
      <Pricing />
      <Testimonials />
      <About />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
