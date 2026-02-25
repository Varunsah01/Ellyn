"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

const faqs = [
  {
    question: "How quickly can I start finding emails?",
    answer:
      "Install the Chrome extension in under 30 seconds, open any LinkedIn profile, and Ellyn surfaces a verified professional email instantly. Or use the dashboard to look up anyone by name and company. Most users send their first outreach email the same day they sign up.",
  },
  {
    question: "How accurate are the email addresses?",
    answer:
      "Ellyn uses a 6-layer resolution cascade with real-time MX and SMTP verification to deliver 95%+ accuracy. Every email comes with a confidence score so you know exactly what to expect before you hit send.",
  },
  {
    question: "How does the AI email drafting work?",
    answer:
      "Ellyn reads the person's role and company, then generates a fully personalized outreach email tailored to your goal — whether that's requesting a referral, pitching a product, or booking a meeting. Every draft is concise, professional, and written to feel human, not templated. Pro users get unlimited AI drafts.",
  },
  {
    question: "Can I use Ellyn for sales and business development?",
    answer:
      "Absolutely. Ellyn is built for anyone who needs to reach professionals directly — SDRs building prospect lists, founders doing outbound, agencies managing client outreach, or job seekers going after referrals. The email discovery engine and AI drafting work the same regardless of your use case.",
  },
  {
    question: "Is Ellyn compliant with email regulations?",
    answer:
      "Yes. Ellyn never auto-sends emails on your behalf — you write, review, and send every message yourself. This keeps you fully compliant with CAN-SPAM and GDPR. We also never scrape or automate LinkedIn, so your account remains safe.",
  },
  {
    question: "What does the Pro plan unlock?",
    answer:
      "Pro gives you unlimited AI-generated drafts tailored to every contact, advanced pipeline tracking so you always know who to follow up with and when, and priority access to new features as we ship them. Whether you're running a serious job search, sales prospecting, or business development — Pro pays for itself fast.",
  },
  {
    question: "Is my information private and secure?",
    answer:
      "Yes, completely. Ellyn only stores what's needed to manage your outreach — saved contacts, draft emails, and status updates. We never sell your data or share it with third parties, and you can delete everything from your settings at any time. Your data stays entirely yours.",
  },
  {
    question: "Can I try it before upgrading to Pro?",
    answer:
      "Yes — start free with no credit card required. The free plan gives you real email discovery and proven outreach templates with no time limit. When you're ready to scale up, upgrading to Pro takes one click. There's genuinely no risk in getting started today.",
  },
];

/**
 * Render the FAQ component.
 * @returns {unknown} JSX output for FAQ.
 * @example
 * <FAQ />
 */
export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32 bg-[#FAFAFA] text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            Everything You Need to{" "}
            <span className="text-primary">Know</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground">
            Common questions about email discovery, outreach, and how Ellyn works.
          </p>
        </motion.div>

        {/* Accordion */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-border/50">
                <AccordionTrigger className="text-left text-lg font-fraunces font-semibold text-foreground hover:text-primary transition-colors py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="font-dm-sans text-muted-foreground leading-relaxed pb-6 text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="font-dm-sans text-foreground font-semibold mb-2">Ready to get started?</p>
          <p className="font-dm-sans text-muted-foreground mb-4">Free to install. No credit card. Your first outreach email in under two minutes.</p>
          <a
            href="mailto:support@ellyn.app"
            className="text-primary hover:underline font-dm-sans font-medium"
          >
            Have a specific question? Reach us here →
          </a>
        </motion.div>
      </div>
    </section>
  );
}