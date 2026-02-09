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
    question: "Will I get banned from LinkedIn?",
    answer:
      "No. We don't automate anything on LinkedIn—no connection requests, no messages, no scraping. You click to save a profile, that's it. 2,000+ users have used this safely for months. LinkedIn can't ban you for clicking and reading public profiles.",
  },
  {
    question: "How accurate are the email addresses?",
    answer:
      "Our pattern database is built from 50,000+ verified professional emails. For tech companies, first.last@company.com is correct 85% of the time. We show you 3-5 patterns ranked by confidence so you can try the most likely ones first. Users report 40% response rates.",
  },
  {
    question: "What's the actual catch? Why is this free?",
    answer:
      "There's no catch. We don't use expensive APIs like Hunter.io ($49/month) or ZoomInfo ($15K/year). Our pattern-matching runs locally in your browser—zero cost to us. When we add optional AI features later, those will cost money. But finding emails and tracking outreach stays free forever.",
  },
  {
    question: "Isn't cold emailing creepy or spammy?",
    answer:
      "It's way less spammy than LinkedIn DMs. Professionals expect work emails to be findable—that's why they're on company websites. Our templates are respectful, short (50-75 words), and focused on asking for advice, not demanding favors. People respond because you're showing initiative, not desperation.",
  },
  {
    question: "How is this different from Hunter.io or Apollo?",
    answer:
      "Hunter.io and Apollo are built for sales teams with big budgets ($49-99/month). They're expensive and often overkill for job seekers. We're 100% free, focused on referrals not sales, and we never risk your LinkedIn account with automation. Plus our templates are proven to work for job seekers specifically.",
  },
  {
    question: "Do I need to know how to code?",
    answer:
      "Nope. It's a Chrome extension—install it in 30 seconds like any other browser extension. Click the icon while on a LinkedIn profile, and it does the rest. If you can use Gmail, you can use this.",
  },
  {
    question: "What if the email bounces?",
    answer:
      "Try the next pattern we suggested. If all 3-5 bounce, we show you how to search for the person's email on the company website or GitHub. About 15% of people require this extra step, but it's still way faster than doing it all manually.",
  },
];

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
            Your{" "}
            <span className="text-primary">Burning Questions</span>, Answered
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground">
            The honest answers to what you're really wondering.
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
          <p className="font-dm-sans text-foreground font-semibold mb-2">Still not convinced?</p>
          <p className="font-dm-sans text-muted-foreground mb-4">Try it free. No credit card. Takes 30 seconds to install.</p>
          <a
            href="mailto:support@ellyn.app"
            className="text-primary hover:underline font-dm-sans font-medium"
          >
            Or email us your questions →
          </a>
        </motion.div>
      </div>
    </section>
  );
}