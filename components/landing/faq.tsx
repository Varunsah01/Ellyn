"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

const faqs = [
  {
    question: "Is this safe for my LinkedIn account?",
    answer:
      "Yes, 100%. Our tool operates as a human-in-the-loop assistant. It never automates any actions on your LinkedIn account, sends connection requests, or DMs. All actions are initiated by your explicit clicks, making it completely safe and compliant.",
  },
  {
    question: "How do you find emails without expensive APIs?",
    answer:
      "We use a smart, heuristic-based inference engine. It generates common professional email patterns (like first.last@company.com) and provides a confidence score, all without relying on costly external enrichment APIs.",
  },
  {
    question: "Do you send emails for me?",
    answer:
      "No. To ensure your privacy and control, our tool drafts the email and then opens it directly in your own email client (like Gmail or Outlook). You are always the one who hits 'Send'.",
  },
  {
    question: "Is this really free?",
    answer:
      "Yes, the v1 of our product with all its core features is completely free. We built this to help jobseekers, and we've focused on a zero-API, cost-minimized architecture to make that possible. Future premium features (like AI rewriting) may be paid.",
  },
  {
    question: "Who is this tool for?",
    answer:
      "Our primary users are jobseekers—students, early to mid-career professionals, career switchers, and anyone actively networking for referrals who wants a safer, more effective way to manage outreach.",
  },
  {
    question: "What happens to my data?",
    answer:
      "Your data is stored securely for your own use. The browser extension processes data locally, and our backend only stores the contact information and drafts that you explicitly save to your account for tracking purposes.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-canvas-white mb-4">
            Frequently Asked{" "}
            <span className="text-electric-rose">Questions</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90">
            Everything you need to know about our outreach assistant.
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
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-muted">
                <AccordionTrigger className="text-left text-lg font-fraunces font-semibold text-canvas-white hover:text-electric-rose">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="font-dm-sans text-canvas-white/70 leading-relaxed">
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
          <p className="font-dm-sans text-canvas-white/70 mb-4">Still have questions?</p>
          <a
            href="mailto:support@outreachassistant.com"
            className="text-electric-rose hover:underline font-dm-sans font-medium"
          >
            Contact our support team
          </a>
        </motion.div>
      </div>
    </section>
  );
}
