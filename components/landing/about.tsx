"use client";

import { Button } from "@/components/ui/button";
import { Shield, PartyPopper, DollarSign } from "lucide-react"; // Updated icons
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, slideInLeft, slideInRight } from "@/lib/animations";

const stats = [
  {
    value: "2,000+",
    label: "Job Seekers Helped",
    icon: PartyPopper,
  },
  {
    value: "850+",
    label: "Interviews Landed",
    icon: Shield,
  },
  {
    value: "$0",
    label: "Cost to You",
    icon: DollarSign,
  },
];

export function About() {
  return (
    <section id="about" className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
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
            I Was{" "}
            <span className="text-electric-rose">Tired of Begging</span> for Referrals on LinkedIn
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
            So I built the tool I wish I had during my own job search.
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
            {/* Abstract, tactile illustration placeholder - kept from previous step */}
            <div className="relative w-full h-[400px] bg-muted rounded-3xl overflow-hidden flex items-center justify-center">
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
                className="w-3/4 h-3/4 bg-gradient-to-br from-electric-rose to-sunset-coral rounded-full opacity-70 blur-xl"
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
                className="absolute w-1/2 h-1/2 bg-canvas-white rounded-lg opacity-20"
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
            <p className="text-lg font-dm-sans text-canvas-white/90 leading-relaxed">
              I spent 4 months applying to 200+ jobs. Got 3 interviews. All from companies where I knew someone. <span className="text-electric-rose font-semibold">The other 197 applications? Crickets.</span>
            </p>

            <p className="text-lg font-dm-sans text-canvas-white/90 leading-relaxed">
              I tried Hunter.io ($49/month), LinkedIn automation tools (terrifying), and writing custom emails for hours. Nothing felt right. Hunter was too expensive for a broke job seeker. Automation risked my account. Custom outreach took forever.
            </p>

            <p className="text-lg font-dm-sans text-canvas-white/90 leading-relaxed">
              So I built Ellyn—the tool I needed. Find emails fast. Get proven templates. Never risk your LinkedIn. <span className="text-electric-rose font-semibold">And it's free because I remember what it's like to be broke and desperate.</span>
            </p>

            <p className="text-lg font-dm-sans text-canvas-white/70 leading-relaxed italic">
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
                  <div className="w-12 h-12 mx-auto mb-3 bg-electric-rose rounded-lg flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-canvas-white" />
                  </div>
                  <div className="text-3xl font-fraunces font-bold text-canvas-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm font-dm-sans text-canvas-white/70">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-6">
              <Link href="/auth/signup">
                <Button size="lg" className="font-dm-sans">
                  Start Your Job Search Journey Free
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
