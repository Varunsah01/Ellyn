"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

export function FinalCTA() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-[#FAFAFA]">
      {/* Subtle Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

      {/* Floating Shapes - Light Theme */}
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
        className="absolute top-10 right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
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
        className="absolute bottom-10 left-10 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border shadow-sm rounded-full text-foreground text-sm font-dm-sans font-medium mb-8">
            <Sparkles className="h-4 w-4 text-primary" />
            850+ landed interviews in 90 days
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-fraunces font-bold text-foreground mb-6 leading-tight">
            Your Next Interview is <br /> One Email Away
          </h2>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl font-dm-sans text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Stop waiting for recruiters to respond. Start reaching decision-makers directly. Takes 30 seconds to install.
          </p>

          {/* CTA Button */}
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="text-lg px-10 h-16 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all group font-dm-sans bg-primary hover:bg-primary/90 text-white rounded-xl"
            >
              Get Started Free—No Credit Card
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          {/* Urgency + Social Proof */}
          <div className="mt-10 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-muted-foreground text-sm font-dm-sans">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Zero ban risk
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Free forever
              </div>
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                30-second setup
              </div>
            </div>
            <p className="text-muted-foreground/80 text-sm font-dm-sans">
              <span className="font-bold text-foreground">347 job seekers</span> started using Ellyn this week
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}