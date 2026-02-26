"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { PersonaSelector } from "@/components/dashboard/PersonaSelector"
import { usePersona } from "@/context/PersonaContext"
import { showToast } from "@/lib/toast"
import type { Persona } from "@/lib/persona-copy"

type Props = {
  onDismiss: () => void
}

const WELCOME_MESSAGES: Record<Persona, string> = {
  job_seeker: "Welcome! We'll help you reach the right people at your target companies.",
  smb_sales: "Welcome! We'll help you build your prospect pipeline and book more meetings.",
}

export function PersonaOnboardingModal({ onDismiss }: Props) {
  const { setPersona } = usePersona()
  const [selected, setSelected] = useState<Persona | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300)
    return () => clearTimeout(timer)
  }, [])

  const handleSkip = () => {
    try {
      localStorage.setItem("ellyn_persona_onboarded", "1")
    } catch {
      // localStorage unavailable
    }
    onDismiss()
  }

  const handleGetStarted = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await setPersona(selected)
      showToast.success(WELCOME_MESSAGES[selected])
      try {
        localStorage.setItem("ellyn_persona_onboarded", "1")
      } catch {
        // localStorage unavailable
      }
      // Trigger dashboard tour for engaged users
      try {
        const { syncOnboardingState } = await import("@/lib/onboarding")
        await syncOnboardingState({ tourPending: true })
      } catch {
        // non-critical
      }
      window.dispatchEvent(new CustomEvent("ellyn:start-tour"))
      onDismiss()
    } catch {
      // Error toast is handled in PersonaContext.
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSkip() }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto"
      >
        <DialogHeader className="mb-2 text-center">
          <DialogTitle
            className="text-2xl"
            style={{ fontFamily: "'Fraunces', serif", color: "#2D2B55" }}
          >
            How are you using Ellyn?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-gray-500">
            We&apos;ll tailor the experience to your goal.
          </DialogDescription>
        </DialogHeader>

        <PersonaSelector value={selected} onChange={setSelected} />

        <Button
          onClick={handleGetStarted}
          disabled={!selected || submitting}
          className="mt-2 w-full"
          style={{
            backgroundColor: selected ? "#7C3AED" : undefined,
            color: selected ? "#FFFFFF" : undefined,
          }}
        >
          {submitting ? "Saving..." : "Get Started"}
        </Button>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-2 w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip for now
        </button>
      </DialogContent>
    </Dialog>
  )
}
