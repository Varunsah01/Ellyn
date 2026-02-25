"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Shield, Scale, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const pillars = [
  {
    icon: Shield,
    title: "Data Protection",
    description:
      "All data encrypted at rest and in transit. Row-level security on every database table. We never sell or share your data with third parties.",
  },
  {
    icon: Scale,
    title: "CAN-SPAM & GDPR Compliant",
    description:
      "Ellyn never auto-sends emails on your behalf. You write, review, and send every message yourself — keeping you fully compliant with email regulations.",
  },
  {
    icon: Lock,
    title: "No LinkedIn Automation",
    description:
      "We don't scrape, automate, or violate LinkedIn's Terms of Service. Your professional account stays safe. Period.",
  },
];

export function TrustAndCompliance() {
  return (
    <section id="trust" className="py-20 md:py-32 bg-[#FAFAFA] text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            Enterprise-Grade{" "}
            <span className="text-primary">Security & Compliance</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Your data is protected. Your outreach is compliant. Your accounts are safe.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {pillars.map((pillar, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full border border-border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group bg-background">
                <CardContent className="p-8 text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <pillar.icon className="h-7 w-7 text-primary" />
                  </div>

                  <h3 className="text-xl font-fraunces font-semibold text-foreground mb-3">
                    {pillar.title}
                  </h3>

                  <p className="font-dm-sans text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-dm-sans text-muted-foreground"
        >
          <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
          <span className="hidden sm:inline text-border">|</span>
          <a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a>
        </motion.div>
      </div>
    </section>
  );
}
