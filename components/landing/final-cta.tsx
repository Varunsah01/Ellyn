"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

export function FinalCTA() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-electric-rose to-sunset-coral" />

      {/* Floating Shapes */}
      <motion.div
        animate={{
          y: [0, -30, 0],
          rotate: [0, 10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-10 right-10 w-32 h-32 bg-canvas-white/10 rounded-full blur-2xl"
      />
      <motion.div
        animate={{
          y: [0, 30, 0],
          rotate: [0, -10, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-10 left-10 w-40 h-40 bg-canvas-white/10 rounded-full blur-2xl"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-canvas-white/20 backdrop-blur-sm rounded-full text-canvas-white text-sm font-dm-sans font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Get Started in Seconds
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-fraunces font-bold text-canvas-white mb-6 leading-tight">
            Ready to Supercharge Your Job Search?
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl font-dm-sans text-canvas-white/90 mb-10 leading-relaxed">
            Start connecting with the right people and landing the interviews you deserve.
          </p>

          {/* CTA Button */}
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="text-lg px-10 h-16 shadow-2xl hover:shadow-xl transition-all group font-dm-sans"
            >
              Get Your Free Outreach Assistant
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          {/* Trust Badges */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-canvas-white/80 text-sm font-dm-sans">
            <div className="flex items-center gap-2 text-electric-rose">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              No LinkedIn Automation
            </div>
            <div className="flex items-center gap-2 text-electric-rose">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              100% Free for v1
            </div>
            <div className="flex items-center gap-2 text-electric-rose">
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Human-in-the-Loop
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
