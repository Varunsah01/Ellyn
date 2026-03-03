"use client";

import { useMemo, useState } from "react";
import { Briefcase, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { usePersona } from "@/context/PersonaContext";
import { setOnboardingState } from "@/lib/onboarding";
import type { Persona } from "@/lib/persona-copy";
import { cn } from "@/lib/utils";

type PersonaCardConfig = {
  persona: Persona;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type PersonaOnboardingModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
};

const PERSONA_CARDS: PersonaCardConfig[] = [
  {
    persona: "job_seeker",
    title: "Job Seeker",
    description:
      "Find hiring managers & recruiters, send personalized cold emails, track applications",
    icon: Briefcase,
  },
  {
    persona: "smb_sales",
    title: "Sales & Business",
    description:
      "Generate B2B leads, run cold outreach campaigns, track pipeline",
    icon: TrendingUp,
  },
];

export function PersonaOnboardingModal({
  open,
  onOpenChange,
  onDismiss,
}: PersonaOnboardingModalProps) {
  const { setPersona } = usePersona();
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const controlled = typeof open === "boolean";
  const isOpen = controlled ? open : true;

  const heading = useMemo(
    () => `Welcome to Ellyn! ${String.fromCodePoint(0x1f44b)}`,
    []
  );

  const closeModal = () => {
    onOpenChange?.(false);
    onDismiss?.();
  };

  const handleContinue = async () => {
    if (!selectedPersona || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await setPersona(selectedPersona);

      // Mark tour as pending so DashboardTour picks it up
      setOnboardingState({ tourPending: true, tourCompleted: false, tourDismissed: false });

      // Fire-and-forget: persist persona_selected milestone to DB
      void fetch("/api/v1/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "persona_selected" }),
      });

      closeModal();

      // Signal the DashboardTour to start immediately
      window.dispatchEvent(new Event("ellyn:start-tour"));
    } catch {
      // Error toast is handled in PersonaContext.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting && !nextOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto border-[#E6E4F2] bg-[#FAFAFA] p-6">
        <DialogHeader className="space-y-2 text-center sm:text-center">
          <DialogTitle className="text-3xl font-semibold text-[#2D2B55]">
            {heading}
          </DialogTitle>
          <DialogDescription className="text-base text-[#5E5B86]">
            How are you planning to use Ellyn?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-2 md:grid-cols-2">
          {PERSONA_CARDS.map((card) => {
            const Icon = card.icon;
            const isSelected = selectedPersona === card.persona;

            return (
              <button
                key={card.persona}
                type="button"
                onClick={() => setSelectedPersona(card.persona)}
                className={cn(
                  "rounded-xl border bg-white p-5 text-left transition-all hover:border-[#FF6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B6B]/40",
                  isSelected
                    ? "border-[#FF6B6B] ring-2 ring-[#FF6B6B]/20"
                    : "border-[#E6E4F2]"
                )}
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F3F1FF] text-[#2D2B55]">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold text-[#2D2B55]">{card.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5E5B86]">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={() => {
              void handleContinue();
            }}
            disabled={!selectedPersona || isSubmitting}
            className="w-full bg-[#2D2B55] text-white hover:bg-[#232047] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
