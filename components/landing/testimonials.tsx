"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const testimonials = [
  {
    quote:
      "This tool is a game-changer. I was struggling to find the right people for referrals, but now I can draft and send outreach emails in minutes, safely.",
    name: "Priya Patel",
    role: "Recent Grad",
    company: "Jobseeker",
    initials: "PP",
  },
  {
    quote:
      "As a career switcher, networking was daunting. This assistant helps me stay organized and draft professional emails without the fear of getting my LinkedIn account banned.",
    name: "David Chen",
    role: "Career Switcher",
    company: "Tech Industry",
    initials: "DC",
  },
  {
    quote:
      "I love that I'm in control. It assists me, it doesn't automate me. Finding emails is so much easier now, and it's completely free.",
    name: "Maria Garcia",
    role: "UX Designer",
    company: "Seeking New Role",
    initials: "MG",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32 bg-midnight-violet text-canvas-white">
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
            Hear from Our{" "}
            <span className="text-electric-rose">Users</span>
          </h2>
          <p className="text-xl font-dm-sans text-canvas-white/90 max-w-2xl mx-auto">
            See what jobseekers are saying about their outreach success.
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
              <Card className="h-full border-2 border-muted hover:border-electric-rose transition-all duration-300 hover:shadow-lg group relative overflow-hidden rounded-lg">
                {/* Quote icon background */}
                <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Quote className="h-20 w-20 text-electric-rose" />
                </div>

                <CardContent className="p-6 relative">
                  {/* Quote */}
                  <div className="mb-6">
                    <Quote className="h-8 w-8 text-electric-rose mb-3" />
                    <p className="font-dm-sans text-canvas-white/90 leading-relaxed italic">
                      "{testimonial.quote}"
                    </p>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-4 pt-4 border-t border-muted">
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-canvas-white font-bold text-lg">
                        {testimonial.initials}
                      </span>
                    </div>

                    {/* Info */}
                    <div>
                      <p className="font-fraunces font-semibold text-canvas-white">
                        {testimonial.name}
                      </p>
                      <p className="text-sm font-dm-sans text-canvas-white/70">
                        {testimonial.role}
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
                className="w-6 h-6 text-electric-rose fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <p className="font-dm-sans text-canvas-white/70">
            Rated <span className="font-semibold">4.9/5</span> by 1,000+ jobseekers
          </p>
        </motion.div>
      </div>
    </section>
  );
}
