"use client";

import { Button } from "@/components/ui/Button";
import { Shield, PartyPopper, DollarSign } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, slideInLeft, slideInRight } from "@/lib/animations";

const stats = [
  {
    value: "5,000+",
    label: "Professionals Helped",
    icon: PartyPopper,
  },
  {
    value: "95%+",
    label: "Email Accuracy",
    icon: Shield,
  },
  {
    value: "100x",
    label: "Cheaper Than Competitors",
    icon: DollarSign,
  },
];

/**
 * Render the About component.
 * @returns {unknown} JSX output for About.
 * @example
 * <About />
 */
export function About() {
  return (
    <section id="about" className="py-20 md:py-32 bg-white text-foreground">
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
            Built by Someone Who{" "}
            <span className="text-primary">Needed It</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            From frustrated job seeker to building a platform used by sales teams and professionals worldwide.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Illustration Placeholder */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={slideInLeft}
            className="relative"
          >
            {/* Abstract, tactile illustration placeholder */}
            <div className="relative w-full h-[400px] bg-secondary/30 rounded-3xl overflow-hidden flex items-center justify-center border border-border/50">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-3/4 h-3/4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-2xl"
              />
              <motion.div
                animate={{
                  scale: [1, 0.95, 1],
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
                className="absolute w-1/2 h-1/2 bg-white rounded-2xl opacity-40 shadow-xl"
              />
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={slideInRight}
            className="space-y-6"
          >
            <p className="text-lg font-dm-sans text-muted-foreground leading-relaxed">
              I spent 4 months applying to 200+ jobs. Got 3 interviews. All from companies where I knew someone. <span className="text-primary font-semibold">The other 197 applications? Crickets.</span>
            </p>

            <p className="text-lg font-dm-sans text-muted-foreground leading-relaxed">
              I tried Hunter.io ($49/month), LinkedIn automation tools (terrifying), and writing custom emails for hours. Nothing felt right. Everything was either too expensive, too risky, or too slow.
            </p>

            <p className="text-lg font-dm-sans text-muted-foreground leading-relaxed">
              So I built Ellyn — fast email discovery, AI-powered drafts, and a pipeline to track it all. What started as a job search tool is now used by <span className="text-primary font-semibold">sales teams, recruiters, and founders who need to reach the right people.</span>
            </p>

            <p className="text-lg font-dm-sans text-foreground/80 leading-relaxed italic">
              — Varun, Founder
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl font-fraunces font-bold text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-dm-sans text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-6">
              <Link href="/auth/signup">
                <Button size="lg" className="font-dm-sans bg-primary hover:bg-primary/90 text-white shadow-lg h-12 px-8 text-lg">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}