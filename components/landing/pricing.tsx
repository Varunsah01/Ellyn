"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, scaleIn } from "@/lib/animations";

const features = [
  "Find emails on LinkedIn (unlimited)",
  "Proven email pattern database",
  "Professional outreach templates",
  "Track all your conversations",
  "Never risk a LinkedIn ban",
  "No credit card ever required",
  "Direct support from founders",
  "Early access to AI features",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-white text-foreground">
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
            Seriously.{" "}
            <span className="text-primary">It's Free.</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            While others charge $49-$99/month, we're 100% free. Forever.
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
          <Card className="border-2 border-primary shadow-2xl shadow-primary/10 relative overflow-hidden rounded-2xl bg-white">
            {/* Popular badge */}
            <div className="absolute top-0 right-0 bg-primary text-white px-6 py-1.5 text-sm font-dm-sans font-semibold">
              FOREVER FREE
            </div>

            <CardHeader className="text-center pt-12 relative pb-2">
              <div className="inline-block px-4 py-1.5 bg-primary/10 rounded-full mb-6">
                <p className="text-sm font-dm-sans font-bold text-primary tracking-wide uppercase">
                  v1 Free Plan
                </p>
              </div>

              <div className="mb-2 flex items-center justify-center gap-1">
                <span className="text-6xl font-fraunces font-bold text-foreground">$0</span>
                <span className="text-xl font-dm-sans text-muted-foreground self-end mb-2">/mo</span>
              </div>

              <p className="font-dm-sans text-muted-foreground">No credit card required.</p>
            </CardHeader>

            <CardContent className="pt-8 pb-10 px-8 relative">
              {/* Features List */}
              <ul className="space-y-4 mb-10">
                {features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-dm-sans text-foreground/80">
                      {feature}
                    </span>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link href="/auth/signup" className="block">
                <Button size="lg" className="w-full font-dm-sans text-lg h-14 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                  Start Free Today
                </Button>
              </Link>

              {/* Trust Badges */}
              <div className="mt-8 space-y-3 pt-6 border-t border-border/50">
                <div className="flex items-center justify-center gap-2 text-sm font-dm-sans text-muted-foreground">
                  <HeartHandshake className="h-5 w-5 text-primary" />
                  <span>2,000+ job seekers trust us</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-sm font-dm-sans text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                  <span className="ml-2 text-muted-foreground">4.9/5 average rating</span>
                </div>
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
          className="text-center mt-16"
        >
          <div className="space-y-4">
            <p className="font-fraunces text-xl text-foreground font-semibold">
              "Wait, what's the catch?"
            </p>
            <p className="font-dm-sans text-muted-foreground max-w-xl mx-auto leading-relaxed">
              There isn't one. We built this for job seekers like us. No API costs means we can keep it free. When we add premium AI features later, they'll be optional upgrades—the core tool stays free forever.
            </p>
            <Link href="#faq" className="inline-block text-primary hover:text-primary/80 font-dm-sans font-medium border-b border-primary/20 hover:border-primary transition-all">
              Read more in our FAQ
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}