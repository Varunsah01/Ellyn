"use client"

import { useState } from "react"
import { PersonaOnboardingModal } from "@/components/dashboard/PersonaOnboardingModal"
import { usePersona } from "@/context/PersonaContext"

export function PersonaOnboardingGate() {
  const { isLoading, onboardingStepsCompleted, refreshOnboardingSteps } = usePersona()
  // Local dismissed flag ensures the modal hides immediately on close,
  // even before the API call that marks persona_selected has resolved.
  const [dismissed, setDismissed] = useState(false)

  const personaSelected = onboardingStepsCompleted.includes("persona_selected")
  const show = !isLoading && !dismissed && !personaSelected

  const handleClose = () => {
    setDismissed(true)
    refreshOnboardingSteps()
  }

  if (!show) return null
  return <PersonaOnboardingModal onDismiss={handleClose} />
}
