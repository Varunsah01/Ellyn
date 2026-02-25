"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fadeInUp } from "@/lib/animations";

/**
 * Render the FinalCTA component.
 * @returns {unknown} JSX output for FinalCTA.
 * @example
 * <FinalCTA />
 */
export function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-[#FAFAFA] text-foreground border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeInUp}
          className="rounded-3xl border border-border bg-white p-10 md:p-14 text-center shadow-sm"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold mb-5 leading-tight">
            Ready to reach
            <span className="text-primary"> the right people</span>?
          </h2>

          <p className="font-dm-sans text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Find verified emails, write personalized outreach, and track every conversation — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button
                size="lg"
                className="h-12 px-7 font-dm-sans bg-primary hover:bg-primary/90 text-white"
              >
                Create Free Account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/auth/login" className="font-dm-sans text-sm text-muted-foreground hover:text-primary transition-colors">
              Already have an account? Log in
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
