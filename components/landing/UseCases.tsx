"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Briefcase, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const useCases = [
  {
    icon: Briefcase,
    title: "For Job Seekers",
    description:
      "Skip the application black hole. Reach hiring managers and referral contacts directly.",
    benefits: [
      "Find hiring managers' emails at any company",
      "Write referral requests that actually get replies",
      "Track your outreach pipeline from contact to interview",
      "AI-crafted messages that feel human, not spammy",
    ],
    cta: "Start Your Job Search",
    href: "/auth/signup",
  },
  {
    icon: TrendingUp,
    title: "For Sales & Business Development",
    description:
      "Build prospect lists, find decision-maker emails, and run outreach that converts.",
    benefits: [
      "Build targeted prospect lists from LinkedIn in seconds",
      "Discover verified emails for key decision-makers",
      "Run multi-step outreach sequences at scale",
      "AI-personalized cold emails that convert",
    ],
    cta: "Start Prospecting",
    href: "/auth/signup",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="py-20 md:py-32 bg-white text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            One Platform.{" "}
            <span className="text-primary">Two Powerful Use Cases.</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Whether you&apos;re landing your next role or closing your next deal, Ellyn gets you to the right inbox.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-8"
        >
          {useCases.map((useCase, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full border border-border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group bg-background">
                <CardContent className="p-8 md:p-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <useCase.icon className="h-7 w-7 text-primary" />
                  </div>

                  <h3 className="text-2xl font-fraunces font-bold text-foreground mb-3">
                    {useCase.title}
                  </h3>

                  <p className="font-dm-sans text-muted-foreground leading-relaxed mb-6">
                    {useCase.description}
                  </p>

                  <ul className="space-y-3 mb-8">
                    {useCase.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10">
                          <Check className="h-3.5 w-3.5 text-primary" />
                        </span>
                        <span className="text-sm font-dm-sans text-foreground/85">
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link href={useCase.href}>
                    <Button className="font-dm-sans bg-primary hover:bg-primary/90 text-white shadow-md">
                      {useCase.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
