"use client";

import { Navigation } from "@/components/landing/Navigation";
import { Footer } from "@/components/landing/Footer";
import { CsrfHiddenInput } from "@/components/CsrfHiddenInput";
import { Mail, MessageSquare, Send } from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would handle form submission here
    console.log("Form submitted:", formData);
    alert("Thank you for your message! We will get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Information */}
          <div className="space-y-8">
            <div>
              <h1 className="font-fraunces text-4xl md:text-5xl font-bold text-foreground mb-6">
                Get in Touch
              </h1>
              <p className="font-dm-sans text-lg text-muted-foreground leading-relaxed">
                Have questions about Ellyn? We're here to help you supercharge your job search and networking efforts.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-fraunces text-xl font-semibold text-foreground">Email Us</h3>
                  <p className="font-dm-sans text-muted-foreground">support@useellyn.com</p>
                  <p className="font-dm-sans text-sm text-muted-foreground mt-1">We typically respond within 24 hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-fraunces text-xl font-semibold text-foreground">Live Support</h3>
                  <p className="font-dm-sans text-muted-foreground">Available for Premium users via the dashboard.</p>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#F5F5F7] border border-border">
              <h3 className="font-fraunces text-xl font-semibold text-foreground mb-4">Frequently Asked Questions</h3>
              <p className="font-dm-sans text-muted-foreground mb-6">
                Check our FAQ section on the landing page for quick answers to common questions about features, pricing, and safety.
              </p>
              <a href="/#faq" className="font-dm-sans text-primary font-medium hover:underline inline-flex items-center gap-2">
                View FAQ <Send className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-8 md:p-10 rounded-3xl border border-border shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <CsrfHiddenInput />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="font-dm-sans text-sm font-medium text-foreground">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-dm-sans"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="font-dm-sans text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-dm-sans"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="font-dm-sans text-sm font-medium text-foreground">
                  Subject
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-dm-sans bg-white"
                >
                  <option value="">Select a topic</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Billing">Billing</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Partnership">Partnership</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="font-dm-sans text-sm font-medium text-foreground">
                  Your Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-dm-sans resize-none"
                  placeholder="How can we help you?"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-primary text-primary-foreground font-dm-sans font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                Send Message <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
