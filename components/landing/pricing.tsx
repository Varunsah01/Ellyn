"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, HeartHandshake } from "lucide-react"; // Updated icon
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, scaleIn } from "@/lib/animations";

const features = [
  "LinkedIn Contact Saver",
  "Heuristic Email Inference",
  "Template-Based Drafting",
  "Manual Outreach Tracker",
  "Unlimited Contacts & Drafts",
  "No-Risk, No-Automation Policy",
  "Community Support",
  "Future Upgrade Path to AI Features",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
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
            Simple,{" "}
            <span className="text-electric-rose">Transparent Pricing</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
            Get all the essential tools for free. No hidden fees, no credit card required.
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          className="max-w-lg mx-auto"
        >
          <Card className="border-4 border-electric-rose shadow-2xl relative overflow-hidden rounded-lg">
            {/* Popular badge */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-electric-rose to-sunset-coral text-canvas-white px-6 py-1 text-sm font-dm-sans font-semibold">
              FOREVER FREE
            </div>

            <CardHeader className="text-center pt-12 relative">
              <div className="inline-block px-4 py-2 bg-muted rounded-lg shadow-md mb-4">
                <p className="text-sm font-fraunces font-semibold text-electric-rose">
                  v1 Free Plan
                </p>
              </div>

              <div className="mb-2">
                <span className="text-6xl font-fraunces font-bold text-canvas-white">$0</span>
              </div>

              <p className="font-dm-sans text-canvas-white/70 text-lg">per month, forever</p>
            </CardHeader>

            <CardContent className="pt-8 pb-8 relative">
              {/* Features List */}
              <ul className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-electric-rose flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-canvas-white" />
                    </div>
                    <span className="font-dm-sans text-canvas-white">
                      {feature}
                    </span>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link href="/auth/signup" className="block">
                <Button size="lg" className="w-full font-dm-sans text-lg h-14 shadow-lg hover:shadow-xl transition-all">
                  Get Started - It's Free
                </Button>
              </Link>

              {/* Trust Badge */}
              <div className="mt-6 flex items-center justify-center gap-2 text-sm font-dm-sans text-canvas-white/70">
                <HeartHandshake className="h-5 w-5 text-electric-rose" />
                <span>No credit card required</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <p className="font-dm-sans text-canvas-white/70">
            Questions about the v1 plan?{" "}
            <a href="#faq" className="text-electric-rose hover:underline font-medium">
              Check our FAQ
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
