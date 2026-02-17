"use client";

import { Card, CardContent } from "@/components/ui/Card";
import {
  UserCheck,
  BrainCircuit,
  FileText,
  ListChecks,
  ShieldCheck,
  PartyPopper,
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const features = [
  {
    icon: UserCheck,
    title: "Get Past the Gatekeepers",
    description:
      "Find the actual decision-makers at your target companies. No more waiting for HR to respond. Example: \"Found the hiring manager's email at Google in 10 seconds.\"",
  },
  {
    icon: BrainCircuit,
    title: "Know Before You Send",
    description:
      "See which email patterns are most likely to work before you hit send. Our confidence scores are based on 50,000+ verified patterns.",
  },
  {
    icon: FileText,
    title: "Sound Professional",
    description:
      "Pre-written templates proven to get responses. No more staring at a blank screen wondering what to write.",
  },
  {
    icon: ListChecks,
    title: "Never Lose Track",
    description:
      "Remember who you contacted and when. No awkward double-messages. Your networking pipeline, organized automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Keep LinkedIn Safe",
    description:
      "Sleep easy knowing you'll never get banned. We don't touch LinkedIn's automation limits because we don't automate anything.",
  },
  {
    icon: PartyPopper,
    title: "Zero Cost, Forever",
    description:
      "Other tools charge $49-99/month. We're free because we don't use expensive APIs. Save money while getting better results.",
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
            Stop Applying.{" "}
            <span className="text-primary relative">
              Start Connecting.
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/20 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Referrals get you hired 3-5x faster than cold applications. Here's how we help you get them.
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
            All of this, completely free. No trials, no upgrades required.
          </p>
        </motion.div>
      </div>
    </section>
  );
}