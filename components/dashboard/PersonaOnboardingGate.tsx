"use client"

import { useEffect, useState } from "react"
import { PersonaOnboardingModal } from "@/components/dashboard/PersonaOnboardingModal"
import { usePersona } from "@/context/PersonaContext"

export function PersonaOnboardingGate() {
  const { isLoading } = usePersona()
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

  // Once the modal saves the persona it sets the flag; re-check to close
  useEffect(() => {
    if (!show) return
    const interval = setInterval(() => {
      try {
        if (localStorage.getItem("ellyn_persona_onboarded")) {
          setShow(false)
        }
      } catch {
        clearInterval(interval)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [show])

  if (!show) return null
  return <PersonaOnboardingModal />
}
