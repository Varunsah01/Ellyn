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
    title: "Safe Contact Saving",
    description:
      "Save potential contacts from LinkedIn profiles with a single click. All actions are user-initiated.",
  },
  {
    icon: BrainCircuit,
    title: "Heuristic Email Inference",
    description:
      "Our system generates and scores potential email addresses using proven heuristics, not expensive APIs.",
  },
  {
    icon: FileText,
    title: "Template-Based Drafting",
    description:
      "Draft polite, referral-focused emails using pre-written templates. You review and edit every message.",
  },
  {
    icon: ListChecks,
    title: "Outreach Tracking",
    description:
      "Keep track of who you've contacted and when with our simple web app. Manually mark outreach status.",
  },
  {
    icon: ShieldCheck,
    title: "No LinkedIn Automation",
    description:
      "Your account's safety is our top priority. We never automate actions on LinkedIn, so there's no ban risk.",
  },
  {
    icon: PartyPopper,
    title: "100% Free for v1",
    description:
      "All core features are completely free. No APIs, no enrichment costs, no hidden fees.",
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
            Everything You Need for a{" "}
            <span className="text-electric-rose">Safer Job Search</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
            Powerful features that make networking effortless, without the risk.
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
            ...and it's all completely free to get started.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
