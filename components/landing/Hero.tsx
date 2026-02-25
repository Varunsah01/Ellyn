"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import { CheckCircle2 } from "lucide-react";

/**
 * Render the Hero component.
 * @returns {unknown} JSX output for Hero.
 * @example
 * <Hero />
 */
export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-dm-sans font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Professional Email Outreach, Simplified
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-fraunces font-bold mb-6 leading-[1.1] text-foreground tracking-tight"
          >
            Find Anyone&apos;s Email. <br className="hidden md:block" />
            Reach Out with <span className="text-primary relative whitespace-nowrap">
              Confidence
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/20 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl font-dm-sans"
          >
            Discover verified email addresses for hiring managers, prospects, or decision-makers. Write personalized outreach powered by AI — and get replies, not silence.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto text-lg px-8 h-14 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl font-dm-sans transition-all hover:scale-105"
              >
                Start Finding Emails Free
              </Button>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.6 }}
             className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground font-dm-sans"
          >
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Free to start</span>
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> No credit card</span>
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> 95%+ accuracy</span>
             <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> GDPR compliant</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}