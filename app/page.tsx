import { Navigation } from "@/components/landing/Navigation";
import { Hero } from "@/components/landing/Hero";
import { DemoVideo } from "@/components/landing/DemoVideo";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ellyn.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "Ellyn",
      description:
        "Professional email finder and outreach platform. Find verified business emails with 95%+ accuracy.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${APP_URL}/dashboard/discovery?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Ellyn",
      alternateName: "Ellyn Email Finder",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/og-image.png`,
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@ellyn.app",
        contactType: "customer support",
      },
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${APP_URL}/#app`,
      name: "Ellyn",
      alternateName: "Ellyn Email Finder",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Chrome Extension",
      offers: [
        {
          "@type": "Offer",
          name: "Free Plan",
          price: "0",
          priceCurrency: "USD",
          description: "50 email lookups per month",
        },
        {
          "@type": "Offer",
          name: "Starter Plan",
          price: "14.99",
          priceCurrency: "USD",
          description: "500 email lookups and 150 AI drafts per month",
        },
        {
          "@type": "Offer",
          name: "Pro Plan",
          price: "34.99",
          priceCurrency: "USD",
          description: "1,500 email lookups and 500 AI drafts per month",
        },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "120",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How quickly can I start finding emails?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Install the Chrome extension in under 30 seconds, open any LinkedIn profile, and Ellyn surfaces a verified professional email instantly. Or use the dashboard to look up anyone by name and company. Most users send their first outreach email the same day they sign up.",
          },
        },
        {
          "@type": "Question",
          name: "How accurate are the email addresses?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ellyn uses a 6-layer resolution cascade with real-time MX and SMTP verification to deliver 95%+ accuracy. Every email comes with a confidence score so you know exactly what to expect before you hit send.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Ellyn for sales and business development?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. Ellyn is built for anyone who needs to reach professionals directly — SDRs building prospect lists, founders doing outbound, agencies managing client outreach, or job seekers going after referrals.",
          },
        },
        {
          "@type": "Question",
          name: "Is Ellyn compliant with email regulations?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Ellyn never auto-sends emails on your behalf — you write, review, and send every message yourself. This keeps you fully compliant with CAN-SPAM and GDPR.",
          },
        },
        {
          "@type": "Question",
          name: "Can I try it before upgrading to Pro?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes — start free with no credit card required. The free plan gives you real email discovery and proven outreach templates with no time limit.",
          },
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-white">
        <Navigation />
        <Hero />
        <DemoVideo />
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
    </>
  );
}
