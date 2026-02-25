"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Render the Navigation component.
 * @returns {unknown} JSX output for Navigation.
 * @example
 * <Navigation />
 */
export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/80 backdrop-blur-lg shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-12 w-[150px] md:h-14 md:w-[170px]">
              <Image
                src="https://subsnacks.sirv.com/Ellyn_logo.png"
                alt="Ellyn logo"
                fill
                sizes="(max-width: 768px) 150px, 170px"
                className="object-contain"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("features")}
              className="text-foreground/80 hover:text-primary transition-colors font-dm-sans font-medium"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("use-cases")}
              className="text-foreground/80 hover:text-primary transition-colors font-dm-sans font-medium"
            >
              Use Cases
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-foreground/80 hover:text-primary transition-colors font-dm-sans font-medium"
            >
              How it Works
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-foreground/80 hover:text-primary transition-colors font-dm-sans font-medium"
            >
              Pricing
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" className="font-dm-sans text-foreground/80 hover:text-primary hover:bg-secondary">
                Login
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="font-dm-sans bg-primary hover:bg-primary/90 text-white shadow-md">
                Sign Up Free
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-border shadow-lg"
          >
            <div className="px-4 py-6 space-y-4">
              <button
                onClick={() => scrollToSection("features")}
                className="block w-full text-left py-2 text-foreground/80 hover:text-primary transition-colors font-dm-sans"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("use-cases")}
                className="block w-full text-left py-2 text-foreground/80 hover:text-primary transition-colors font-dm-sans"
              >
                Use Cases
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="block w-full text-left py-2 text-foreground/80 hover:text-primary transition-colors font-dm-sans"
              >
                How it Works
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className="block w-full text-left py-2 text-foreground/80 hover:text-primary transition-colors font-dm-sans"
              >
                Pricing
              </button>
              <div className="pt-4 space-y-2">
                <Link href="/auth/login" className="block">
                  <Button variant="outline" className="w-full font-dm-sans border-border text-foreground hover:bg-secondary">
                    Login
                  </Button>
                </Link>
                <Link href="/auth/signup" className="block">
                  <Button className="w-full font-dm-sans bg-primary text-white">
                    Sign Up Free
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}