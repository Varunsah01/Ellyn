"use client"

import { useEffect, useState } from "react"
import { PersonaOnboardingModal } from "@/components/dashboard/PersonaOnboardingModal"
import { usePersona } from "@/context/PersonaContext"

export function PersonaOnboardingGate() {
  const { isLoading, refreshOnboardingSteps } = usePersona()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isLoading) return
    try {
      const alreadyOnboarded = localStorage.getItem("ellyn_persona_onboarded")
      if (!alreadyOnboarded) {
        setShow(true)
      }
    } catch {
      // localStorage unavailable — skip modal
    }
  }, [isLoading])

  const handleClose = () => {
    setShow(false)
    refreshOnboardingSteps()
  }

  if (!show) return null
  return <PersonaOnboardingModal onDismiss={handleClose} />
}
