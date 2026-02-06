"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  UserCheck, // For Safe Contact Saving
  BrainCircuit, // For Heuristic Email Inference
  FileText, // For Template-Based Drafting
  ListChecks, // For Outreach Tracking
  ShieldCheck, // For No LinkedIn Automation
  PartyPopper, // For 100% Free
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
      "See which email patterns are most likely to work before you hit send. Our confidence scores are based on 50,000+ verified patterns. Example: \"first.last@company.com\" scores 85% for tech companies.",
  },
  {
    icon: FileText,
    title: "Sound Professional, Not Desperate",
    description:
      "Pre-written templates proven to get responses. No more staring at a blank screen wondering what to write. Example: Average response rate of 34% vs. 8% for generic outreach.",
  },
  {
    icon: ListChecks,
    title: "Never Lose Track Again",
    description:
      "Remember who you contacted and when. No awkward double-messages. Your networking pipeline, organized automatically. Example: \"Followed up with Sarah exactly 5 days later—got the interview.\"",
  },
  {
    icon: ShieldCheck,
    title: "Keep Your LinkedIn Safe",
    description:
      "Sleep easy knowing you'll never get banned. We don't touch LinkedIn's automation limits because we don't automate anything. Example: \"Used this for 3 months, still have my account.\"",
  },
  {
    icon: PartyPopper,
    title: "Zero Cost, Forever",
    description:
      "Other tools charge $49-99/month. We're free because we don't use expensive APIs. Example: \"Saved $588/year compared to Hunter.io while getting better results.\"",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-canvas-white mb-4">
            Stop Applying.{" "}
            <span className="text-electric-rose">Start Connecting.</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
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
              <Card className="h-full border-2 border-muted hover:border-electric-rose transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                <CardContent className="p-6">
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 rounded-lg bg-electric-rose flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="h-7 w-7 text-canvas-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-fraunces font-semibold text-canvas-white mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="font-dm-sans text-canvas-white/70 leading-relaxed">
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
          <p className="font-dm-sans text-canvas-white/70">
            All of this, completely free. No trials, no upgrades required.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
