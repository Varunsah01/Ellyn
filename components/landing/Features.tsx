"use client";

import { Card, CardContent } from "@/components/ui/Card";
import {
  UserCheck,
  BadgeCheck,
  FileText,
  ListChecks,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const features = [
  {
    icon: UserCheck,
    title: "Find the Right People",
    description:
      "Discover verified professional emails for anyone — hiring managers, prospects, founders, or executives. Our 6-layer resolution engine delivers 95%+ accuracy across 100,000+ companies.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Before You Send",
    description:
      "Every email is checked against real-time MX records and SMTP verification. Confidence scores show exactly how likely each address is to land. No more bounced emails.",
  },
  {
    icon: FileText,
    title: "AI-Crafted Messages",
    description:
      "Generate personalized outreach in seconds. Our AI reads context from LinkedIn profiles and company data to write messages that feel human — whether it's a referral request or a sales pitch.",
  },
  {
    icon: ListChecks,
    title: "Organized Outreach Pipeline",
    description:
      "Track every contact, email, and follow-up in one dashboard. Manage sequences, monitor response rates, and never let a warm lead go cold.",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Compliant",
    description:
      "No LinkedIn automation. No scraping. No risk to your account. Ellyn works alongside LinkedIn without violating any terms of service. Your data stays private and secure.",
  },
  {
    icon: Coins,
    title: "100x More Affordable",
    description:
      "Other email discovery tools charge $49–99/month. Ellyn starts free and our paid plans are a fraction of the cost — because we built smarter infrastructure, not bigger invoices.",
  },
];

/**
 * Render the Features component.
 * @returns {unknown} JSX output for Features.
 * @example
 * <Features />
 */
export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 bg-white text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            Everything You Need for{" "}
            <span className="text-primary relative">
              Effective Outreach
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/20 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            From finding the right email to crafting the perfect message — Ellyn handles the hard parts so you can focus on building relationships.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full border border-border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group bg-background">
                <CardContent className="p-8">
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors`}
                  >
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-fraunces font-semibold text-foreground mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="font-dm-sans text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <p className="font-dm-sans text-muted-foreground font-medium">
            Start free with 50 email lookups per month. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  );
}