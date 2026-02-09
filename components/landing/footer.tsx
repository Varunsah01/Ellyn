"use client";

import { Twitter, Linkedin, Github } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  product: [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Dashboard", href: "/dashboard" },
  ],
  company: [
    { name: "About Us", href: "#about" },
    { name: "Contact Us", href: "mailto:support@useellyn.com" },
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
    <footer className="bg-[#F5F5F7] text-foreground border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center">
              <div className="relative h-10 w-[140px]">
                <img
                  src="https://subsnacks.sirv.com/Ellyn_logo.png"
                  alt="Ellyn logo"
                  className="h-full w-full object-contain"
                />
              </div>
            </Link>
            <p className="font-dm-sans text-muted-foreground text-sm leading-relaxed">
              Your safe and effective outreach assistant for job seeking.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-white border border-border hover:border-primary/50 hover:text-primary flex items-center justify-center transition-all text-muted-foreground shadow-sm"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-fraunces font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith("#") ? (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="font-dm-sans text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {link.name}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-dm-sans text-muted-foreground hover:text-primary transition-colors text-sm"
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
            <h3 className="font-fraunces font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  {link.href.startsWith("#") && link.href !== "#" ? (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="font-dm-sans text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {link.name}
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      className="font-dm-sans text-muted-foreground hover:text-primary transition-colors text-sm"
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
            <h3 className="font-fraunces font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="font-dm-sans text-muted-foreground hover:text-primary transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-dm-sans text-muted-foreground text-sm">
              © 2026 Eigenspace Technologies PVT.Ltd. All rights reserved.
            </p>
            <p className="font-dm-sans text-muted-foreground text-sm flex items-center gap-1">
              Built with <span className="text-red-500">❤️</span> for jobseekers worldwide
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}