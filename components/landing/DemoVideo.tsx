"use client";

import { motion, AnimatePresence } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import {
  Search,
  Globe,
  Server,
  CheckCircle2,
  Sparkles,
  Mail,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";

const STEP_DURATIONS = [3000, 4000, 5000];
const LOOP_PAUSE = 2000;

function TypingText({
  text,
  durationMs,
  className,
}: {
  text: string;
  durationMs: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    const charDelay = durationMs / text.length;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, charDelay);
    return () => clearInterval(interval);
  }, [text, durationMs]);

  return (
    <span className={className}>
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  );
}

function SearchStep() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-primary" />
        <span className="text-sm font-dm-sans font-medium text-foreground">
          Email Discovery
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-dm-sans text-muted-foreground">
            Full Name
          </label>
          <div className="h-10 rounded-lg border border-border bg-white px-3 flex items-center text-sm font-dm-sans text-foreground">
            <TypingText text="Sarah Chen" durationMs={1200} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-dm-sans text-muted-foreground">
            Company
          </label>
          <div className="h-10 rounded-lg border border-border bg-white px-3 flex items-center text-sm font-dm-sans text-foreground">
            <TypingText text="Stripe" durationMs={1400} />
          </div>
        </div>
      </div>

      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
        className="inline-flex"
      >
        <div className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-dm-sans font-medium flex items-center gap-2 shadow-md shadow-primary/20">
          <Search className="w-4 h-4" />
          Find Email
        </div>
      </motion.div>
    </motion.div>
  );
}

function DiscoveryStep() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1200);
    const t2 = setTimeout(() => setStage(2), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const stages = ["Generating patterns…", "Verifying email…", "Complete"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        {stages.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <motion.div
              className={`w-3 h-3 rounded-full border-2 ${
                i <= stage
                  ? "bg-green-500 border-green-500"
                  : "bg-white border-border"
              }`}
              animate={
                i <= stage ? { scale: [1, 1.2, 1] } : {}
              }
              transition={{ duration: 0.3 }}
            />
            <span
              className={`text-xs font-dm-sans ${
                i <= stage
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < stages.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  i < stage ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Company info card */}
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border bg-white p-4 space-y-2"
          >
            <p className="text-xs font-dm-sans font-medium text-muted-foreground uppercase tracking-wider">
              Company Info
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-sm font-dm-sans text-foreground">
                  stripe.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-sm font-dm-sans text-foreground">
                  Google Workspace
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultsStep() {
  const [showDraft, setShowDraft] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowDraft(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Email result card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-xl border border-border bg-white p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <span className="text-xs font-dm-sans font-medium text-muted-foreground uppercase tracking-wider">
            Result
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <code className="text-sm font-mono text-foreground bg-muted/50 px-2.5 py-1 rounded-md">
            sarah.chen@stripe.com
          </code>
          <span className="inline-flex items-center gap-1 text-xs font-dm-sans font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            94% confidence
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-dm-sans font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        </div>
      </motion.div>

      {/* AI Draft button + preview */}
      <div className="space-y-3">
        <motion.div
          animate={
            !showDraft
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(var(--primary-rgb, 99, 102, 241), 0)",
                    "0 0 0 8px rgba(var(--primary-rgb, 99, 102, 241), 0.15)",
                    "0 0 0 0 rgba(var(--primary-rgb, 99, 102, 241), 0)",
                  ],
                }
              : {}
          }
          transition={{
            duration: 1.5,
            repeat: showDraft ? 0 : Infinity,
          }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-dm-sans font-medium"
        >
          <Sparkles className="w-4 h-4" />
          AI Draft
        </motion.div>

        <AnimatePresence>
          {showDraft && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-border bg-white p-4 space-y-2"
            >
              <p className="text-xs font-dm-sans font-medium text-muted-foreground uppercase tracking-wider">
                AI Draft Preview
              </p>
              <p className="text-sm font-dm-sans text-foreground font-medium">
                Subject: Quick question about Stripe&apos;s growth team
              </p>
              <p className="text-sm font-dm-sans text-muted-foreground leading-relaxed">
                Hi Sarah, I came across your work at Stripe and was really
                impressed by the payments infrastructure your team has built. I&apos;d
                love to connect briefly about…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function DemoVideo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const advanceStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next > 2) return -1; // -1 = pausing before loop
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isInView || prefersReducedMotion) return;

    if (currentStep === -1) {
      // Loop pause
      timerRef.current = setTimeout(() => setCurrentStep(0), LOOP_PAUSE);
    } else {
      timerRef.current = setTimeout(advanceStep, STEP_DURATIONS[currentStep]);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isInView, prefersReducedMotion, advanceStep]);

  const displayStep = prefersReducedMotion ? 2 : Math.max(currentStep, 0);

  return (
    <section id="demo" className="py-16 md:py-24 bg-[#FAFAFA]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            See How It <span className="text-primary">Works</span>
          </h2>
          <p className="text-lg md:text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            From name to verified email to personalized outreach — in under 3
            minutes
          </p>
        </motion.div>

        {/* Mock App Window */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeInUp}
          onViewportEnter={() => {
            setIsInView(true);
            setCurrentStep(0);
          }}
          onViewportLeave={() => {
            setIsInView(false);
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          className="rounded-2xl border border-border shadow-2xl bg-white overflow-hidden"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="text-xs font-dm-sans text-muted-foreground bg-white/70 px-4 py-1 rounded-md border border-border/50">
                Ellyn Dashboard
              </div>
            </div>
            <div className="w-[52px]" /> {/* Balance spacer */}
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 px-4 pt-4 pb-2">
            {["Search", "Discovery", "Results"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-dm-sans font-medium transition-colors duration-300 ${
                    i === displayStep
                      ? "bg-primary/10 text-primary"
                      : i < displayStep
                        ? "bg-green-50 text-green-700"
                        : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {i < displayStep ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 2 && (
                  <div
                    className={`w-6 h-0.5 transition-colors duration-300 ${
                      i < displayStep ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Animation content */}
          <div className="p-5 md:p-8 min-h-[260px] sm:min-h-[240px]">
            <AnimatePresence mode="wait">
              {displayStep === 0 && <SearchStep key="search" />}
              {displayStep === 1 && <DiscoveryStep key="discovery" />}
              {displayStep === 2 && <ResultsStep key="results" />}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Bottom text */}
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="text-center text-sm font-dm-sans text-muted-foreground mt-6"
        >
          Works on any LinkedIn profile. No scraping. 95%+ accuracy.
        </motion.p>
      </div>
    </section>
  );
}
