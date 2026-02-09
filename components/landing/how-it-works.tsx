"use client";

import { UserPlus, MailCheck, Send } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Find the Right Person",
    description:
      "Browse LinkedIn for someone at your target company. Click our extension to save their profile. Takes 10 seconds.",
    time: "10 sec",
  },
  {
    number: "02",
    icon: MailCheck,
    title: "Get Their Email",
    description:
      "We instantly show you their most likely email addresses with confidence scores. No guessing, no hunting.",
    time: "5 sec",
  },
  {
    number: "03",
    icon: Send,
    title: "Send & Get Results",
    description:
      "Use our proven template, add a personal touch, and send from your Gmail. Track responses in one place.",
    time: "2 min",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-[#FAFAFA] text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-20"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            From LinkedIn to Inbox in{" "}
            <span className="text-primary">Under 3 Minutes</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Most people spend hours finding emails and writing outreach. You'll do it in minutes.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="relative"
        >
          {/* Connecting line - desktop only */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

          <div className="grid md:grid-cols-3 gap-12 lg:gap-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step Number Badge */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full shadow-md flex items-center justify-center border border-border z-20">
                  <span className="text-lg font-fraunces font-bold text-primary">
                    {step.number}
                  </span>
                </div>

                {/* Icon Container */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`w-24 h-24 rounded-2xl bg-white flex items-center justify-center mb-8 shadow-lg border border-border/50 relative z-10`}
                >
                  <step.icon className="h-10 w-10 text-primary" />
                </motion.div>

                {/* Content */}
                <div className="inline-flex items-center gap-2 mb-3">
                  <h3 className="text-2xl font-fraunces font-bold text-foreground">
                    {step.title}
                  </h3>
                  <span className="text-xs font-dm-sans font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {step.time}
                  </span>
                </div>
                <p className="font-dm-sans text-muted-foreground leading-relaxed max-w-xs">
                  {step.description}
                </p>

                {/* Arrow - desktop only */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-12 text-muted-foreground/20">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-16"
        >
          <div className="inline-block bg-white border border-border rounded-xl px-8 py-6 mb-8 shadow-sm">
            <p className="text-xl font-fraunces font-bold text-primary mb-1">
              Total time: ~3 minutes per contact
            </p>
            <p className="text-sm font-dm-sans text-muted-foreground">
              Sarah landed 3 interviews in her first week using this flow.
            </p>
          </div>
          <div>
            <Link href="/auth/signup">
              <Button size="lg" className="font-dm-sans h-12 px-8 text-lg bg-primary hover:bg-primary/90 text-white shadow-md">
                Start Your First Outreach Free
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}