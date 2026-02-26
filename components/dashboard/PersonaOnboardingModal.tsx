"use client"

import { useState } from "react"

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

const WELCOME_MESSAGES: Record<Persona, string> = {
  job_seeker: "Welcome! We'll help you reach the right people at your target companies.",
  smb_sales: "Welcome! We'll help you build your prospect pipeline and book more meetings.",
}

export function PersonaOnboardingModal() {
  const { setPersona } = usePersona()
  const [selected, setSelected] = useState<Persona | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleGetStarted = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await setPersona(selected)
      showToast.success(WELCOME_MESSAGES[selected])
      // Mark modal as seen in localStorage so it does not reshow
      try {
        localStorage.setItem("ellyn_persona_onboarded", "1")
      } catch {
        // localStorage unavailable
      }
    } catch {
      showToast.error("Couldn't save your preference. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      // Non-dismissible: no onOpenChange - user must make a choice
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto [&>button]:hidden"
        // Remove the default X close button by overriding onPointerDownOutside and onEscapeKeyDown
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
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
      </DialogContent>
    </Dialog>
  )
}
