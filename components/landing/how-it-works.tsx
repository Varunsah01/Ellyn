"use client";

import { UserPlus, MailCheck, Send } from "lucide-react"; // Updated icons
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { Button } from "@/components/ui/button"; // Import Button component

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Save Contact",
    description:
      "Find a potential contact on LinkedIn and save their profile with one click.",
  },
  {
    number: "02",
    icon: MailCheck,
    title: "Draft & Infer",
    description:
      "We infer their professional email and draft a polite, referral-focused message for you.",
  },
  {
    number: "03",
    icon: Send,
    title: "Send & Track",
    description:
      "Open the draft in your own email client, send it, and track its status in our web app.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-20"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-canvas-white mb-4">
            Your Outreach Workflow in{" "}
            <span className="text-electric-rose">3 Simple Steps</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
            From finding a contact to sending a personalized email, we assist you at every stage.
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
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-electric-rose/50 to-sunset-coral/50" />

          <div className="grid md:grid-cols-3 gap-12 lg:gap-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step Number Badge */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-muted rounded-full shadow-lg flex items-center justify-center border-2 border-muted-foreground/30">
                  <span className="text-lg font-fraunces font-bold text-electric-rose">
                    {step.number}
                  </span>
                </div>

                {/* Icon Container */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className={`w-24 h-24 rounded-lg bg-electric-rose flex items-center justify-center mb-6 shadow-xl relative z-10`}
                >
                  <step.icon className="h-12 w-12 text-canvas-white" />
                </motion.div>

                {/* Content */}
                <h3 className="text-2xl font-fraunces font-bold text-canvas-white mb-3">
                  {step.title}
                </h3>
                <p className="font-dm-sans text-canvas-white/70 leading-relaxed max-w-xs">
                  {step.description}
                </p>

                {/* Arrow - desktop only */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-12 text-muted-foreground/50">
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
          <p className="text-lg font-dm-sans text-canvas-white/90 mb-6">
            Ready to streamline your job search?
          </p>
          <Button className="font-dm-sans">
            Get Started Free
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
