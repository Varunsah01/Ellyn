"use client";

import { Navigation } from "@/components/landing/Navigation";
import { Footer } from "@/components/landing/Footer";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="space-y-8">
          <div>
            <h1 className="font-fraunces text-4xl md:text-5xl font-bold text-foreground mb-6">
              Get in Touch
            </h1>
            <p className="font-dm-sans text-lg text-muted-foreground leading-relaxed">
              We currently handle support only via email.
            </p>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-3xl border border-border shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-fraunces text-2xl font-semibold text-foreground">Email Support</h2>
                <a
                  href="mailto:support@useellyn.com"
                  className="font-dm-sans text-primary hover:underline"
                >
                  support@useellyn.com
                </a>
                <p className="font-dm-sans text-sm text-muted-foreground mt-2">
                  We typically respond within 24 hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
