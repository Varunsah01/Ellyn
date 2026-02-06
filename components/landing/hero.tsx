"use client";

import { Button } from "@/components/ui/button";
import { Play } from "lucide-react"; // Sparkles icon removed as it's part of the old badge
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations"; // slideInRight removed as illustration is removed

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-midnight-violet text-canvas-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-1 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-electric-rose text-canvas-white rounded-lg text-sm font-dm-sans font-medium mb-6"
            >
              Zero Risk • 100% Free • Proven Email Patterns
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-fraunces font-bold mb-6 leading-tight">
              Stop Sending Your Resume
              <br />
              Into the <span className="text-electric-rose">Void</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl font-dm-sans text-canvas-white/90 mb-8 leading-relaxed max-w-2xl mx-auto">
              Get referrals from real people at your dream companies. Find their emails, draft personalized outreach, and skip the LinkedIn ban risk—all completely free.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  className="text-lg px-8 h-14 shadow-lg hover:shadow-xl transition-all font-dm-sans"
                >
                  Start Getting Referrals Free
                </Button>
              </Link>
            </div>

            {/* Trust badge */}
            <p className="mt-6 text-sm text-canvas-white/70 font-dm-sans">
              No credit card • No automation • No LinkedIn ban risk
            </p>
          </motion.div>
        </div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-canvas-white/70 mb-6 font-dm-sans font-medium">
            Trusted by 2,000+ job seekers who landed referrals
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-32 h-12 bg-muted rounded-lg" // Using muted for placeholder
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
