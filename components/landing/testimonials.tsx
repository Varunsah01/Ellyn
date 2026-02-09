"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const testimonials = [
  {
    quote:
      "Got 3 referral conversations in my first week. Before this, I was sending LinkedIn messages that went nowhere. Having actual emails made all the difference.",
    name: "Priya Patel",
    role: "Software Engineer",
    company: "Landed at Google",
    initials: "PP",
    metric: "3 interviews in 1 week",
  },
  {
    quote:
      "I was terrified of getting banned using automation tools. This is so much safer—I'm in control of every message. Used it for 60+ contacts, account still perfect.",
    name: "David Chen",
    role: "Product Manager",
    company: "Career Switcher",
    initials: "DC",
    metric: "60+ safe contacts",
  },
  {
    quote:
      "Saved me $588 compared to Hunter.io. The email patterns are just as accurate, templates get 40% response rates, and it's completely free. No-brainer.",
    name: "Maria Garcia",
    role: "UX Designer",
    company: "Landed at Meta",
    initials: "MG",
    metric: "40% response rate",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32 bg-white text-foreground">
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
            Real People.{" "}
            <span className="text-primary">Real Results.</span>
          </h2>
          <p className="text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Job seekers are landing interviews faster with direct email outreach.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg group relative overflow-hidden rounded-xl bg-[#FAFAFA]">
                {/* Quote icon background */}
                <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Quote className="h-20 w-20 text-primary" />
                </div>

                <CardContent className="p-8 relative">
                  {/* Metric Badge */}
                  <div className="inline-block bg-primary/10 rounded-lg px-3 py-1 mb-6">
                    <p className="text-sm font-dm-sans font-semibold text-primary">
                      {testimonial.metric}
                    </p>
                  </div>

                  {/* Quote */}
                  <div className="mb-8">
                    <Quote className="h-6 w-6 text-primary/50 mb-3" />
                    <p className="font-dm-sans text-foreground/80 leading-relaxed text-lg">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-4 pt-6 border-t border-border/50">
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-primary font-bold text-lg">
                        {testimonial.initials}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <p className="font-fraunces font-semibold text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-sm font-dm-sans text-muted-foreground">
                        {testimonial.role}
                      </p>
                      <p className="text-xs font-dm-sans text-primary font-medium mt-0.5">
                        {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Star Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className="w-6 h-6 text-amber-400 fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <p className="font-dm-sans text-muted-foreground">
            Rated <span className="font-semibold text-foreground">4.9/5</span> by 2,000+ job seekers • <span className="font-semibold text-foreground">850+</span> landed interviews in the last 90 days
          </p>
        </motion.div>
      </div>
    </section>
  );
}