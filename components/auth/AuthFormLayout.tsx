"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/Alert";

interface AuthFormLayoutProps {
  title: string;
  subtitle: string;
  isSupabaseConfigured: boolean;
  errorMessage?: string;
  successMessage?: string;
  isBusy?: boolean;
  children: ReactNode;
}

const TRUST_BULLETS = [
  "95%+ email accuracy on LinkedIn profiles",
  "Free plan — no credit card required",
  "Trusted by 1,000+ job seekers & recruiters",
];

function CoralCheck() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-[#FF6B6B]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/**
 * Render the AuthFormLayout component.
 * @param {AuthFormLayoutProps} props - Component props.
 * @returns {JSX.Element} JSX output for AuthFormLayout.
 */
export function AuthFormLayout({
  title,
  subtitle,
  isSupabaseConfigured,
  errorMessage,
  successMessage,
  isBusy = false,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="min-h-screen flex font-dm-sans">
      {/* LEFT PANEL — Midnight Violet, desktop only */}
      <div className="hidden md:flex md:w-2/5 flex-col bg-[#180B26] px-10 py-12">
        {/* Logo */}
        <Link href="/" className="inline-block" aria-label="Go to Ellyn home">
          <img
            src="https://subsnacks.sirv.com/Ellyn_logo.png"
            alt="Ellyn"
            className="h-10 w-auto object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </Link>

        {/* Main quote */}
        <div className="flex-1 flex items-center mt-16">
          <blockquote className="font-fraunces text-3xl text-white italic leading-snug">
            &ldquo;Your next opportunity starts with the right connection.&rdquo;
          </blockquote>
        </div>

        {/* Trust bullets */}
        <ul className="space-y-3 mt-12">
          {TRUST_BULLETS.map((text) => (
            <li key={text} className="flex items-center gap-3 text-sm text-white/80 font-dm-sans">
              <CoralCheck />
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 bg-[#FAFAFA] flex flex-col items-center justify-center px-4 py-12 md:px-12">
        {/* Mobile-only logo */}
        <Link href="/" className="md:hidden mb-8 inline-block" aria-label="Go to Ellyn home">
          <img
            src="https://subsnacks.sirv.com/Ellyn_logo.png"
            alt="Ellyn"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Form card */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 md:p-10 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-fraunces text-3xl text-[#2D2B55] leading-tight">{title}</h1>
            <p className="font-dm-sans text-sm text-[#6B6982] mt-2">{subtitle}</p>
          </div>

          {/* Supabase not configured */}
          {!isSupabaseConfigured && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                Supabase is not configured. Update <code>.env</code> with valid public keys.
              </AlertDescription>
            </Alert>
          )}

          {/* Error alert */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Success alert */}
          {successMessage && (
            <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-700">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Form children */}
          <div
            aria-busy={isBusy}
            className={isBusy ? "pointer-events-none opacity-80 transition-opacity" : ""}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AuthPageLoadingProps {
  text: string;
}

/**
 * Render the AuthPageLoading component.
 * @param {AuthPageLoadingProps} props - Component props.
 * @returns {JSX.Element} JSX output for AuthPageLoading.
 */
export function AuthPageLoading({ text }: AuthPageLoadingProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="text-sm text-[#6B6982] font-dm-sans">{text}</div>
    </div>
  );
}
