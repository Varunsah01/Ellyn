"use client";

import { Twitter, Linkedin, Github } from "lucide-react"; // Mail removed as it's not part of Ellyn's social presence
import Link from "next/link";

const footerLinks = {
  product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Dashboard", href: "/dashboard" },
  ],
  company: [
    { name: "About Us", href: "#about" },
    { name: "Contact Us", href: "mailto:support@outreachassistant.com" }, // Updated email
    { name: "Blog", href: "#" },
    { name: "Community", href: "#" },
  ],
  legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Github, href: "#", label: "GitHub" },
];

export function Footer() {
  const scrollToSection = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.getElementById(href.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer className="bg-midnight-violet text-canvas-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {/* Ellyn Swatch Icon */}
              <div className="w-10 h-10 bg-midnight-violet rounded-lg flex items-center justify-center">
                {/* No Mail icon, as the Swatch is the icon itself */}
              </div>
              {/* Ellyn Wordmark */}
              <span className="text-3xl font-fraunces font-bold text-canvas-white lowercase">ellyn</span>
            </div>
            <p className="font-dm-sans text-canvas-white/70 text-sm">
              Your safe and effective outreach assistant for job seeking.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-muted hover:bg-muted-foreground/30 flex items-center justify-center transition-colors text-canvas-white"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-fraunces font-semibold text-canvas-white mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith("#") ? (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="font-dm-sans text-canvas-white/70 hover:text-electric-rose transition-colors text-sm"
                    >
                      {link.name}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-dm-sans text-canvas-white/70 hover:text-electric-rose transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-fraunces font-semibold text-canvas-white mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith("#") && link.href !== "#" ? (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="font-dm-sans text-canvas-white/70 hover:text-electric-rose transition-colors text-sm"
                    >
                      {link.name}
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      className="font-dm-sans text-canvas-white/70 hover:text-electric-rose transition-colors text-sm"
                    >
                      {link.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="font-fraunces font-semibold text-canvas-white mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="font-dm-sans text-canvas-white/70 hover:text-electric-rose transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-muted">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-dm-sans text-canvas-white/70 text-sm">
              © 2024 Outreach Assistant. All rights reserved.
            </p>
            <p className="font-dm-sans text-canvas-white/70 text-sm">
              Built with ❤️ for jobseekers worldwide
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
