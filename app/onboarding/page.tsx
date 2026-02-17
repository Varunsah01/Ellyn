"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  getOnboardingState,
  getUserPreferences,
  syncOnboardingState,
  syncUserPreferences,
} from "@/lib/onboarding"
import { OnboardingStepper } from "@/components/onboarding/Stepper"
import { WelcomeStep } from "@/components/onboarding/WelcomeStep"
import { ExtensionStep } from "@/components/onboarding/ExtensionStep"
import { SetupStep } from "@/components/onboarding/SetupStep"
import { Button } from "@/components/ui/Button"

const extensionUrl =
  process.env.NEXT_PUBLIC_EXTENSION_URL ?? "https://chromewebstore.google.com"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [fullName, setFullName] = useState("")
  const [currentRole, setCurrentRole] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [aiApiKey, setAiApiKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const state = getOnboardingState()
    if (state.completed) {
      router.replace("/dashboard")
      return
    }
    setStep(state.step || 1)

    const preferences = getUserPreferences()
    setFullName(preferences.fullName)
    setCurrentRole(preferences.currentRole)
    setTargetRole(preferences.targetRole)
    setAiApiKey(preferences.aiApiKey ?? "")
  }, [router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const chromeRuntime = (window as any).chrome?.runtime
    const isInstalled = Boolean(chromeRuntime?.id)
    setExtensionInstalled(isInstalled)
  }, [])

  const goToStep = async (nextStep: number) => {
    setStep(nextStep)
    await syncOnboardingState({ step: nextStep })
  }

  const handleSkip = async () => {
    await syncOnboardingState({ completed: true, dismissed: true, tourPending: false })
    router.replace("/dashboard")
  }

  const handleSubmit = async () => {
    setError(null)
    if (!fullName || fullName.trim().length < 2) {
      setError("Please enter your name so we can personalize your signatures.")
      return
    }
    setIsSubmitting(true)
    await syncUserPreferences({
      fullName: fullName.trim(),
      currentRole: currentRole.trim(),
      targetRole: targetRole.trim(),
      aiApiKey: aiApiKey.trim(),
    })
    await syncOnboardingState({
      step: 3,
      completed: true,
      tourPending: true,
      dismissed: false,
    })
    setIsSubmitting(false)
    router.replace("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-[150px]">
              <Image
                src="https://subsnacks.sirv.com/Copy%20of%20Ellyn's%20Brandbook%20(1).png"
                alt="Ellyn"
                fill
                sizes="150px"
                className="object-contain"
                priority
              />
            </div>
          </div>
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
        </div>

        <div className="rounded-3xl border bg-white/90 shadow-xl p-8 md:p-12 space-y-10">
          <OnboardingStepper currentStep={step} />

          {step === 1 && <WelcomeStep onNext={() => goToStep(2)} />}

          {step === 2 && (
            <ExtensionStep
              extensionInstalled={extensionInstalled}
              onInstall={() => null}
              onConfirmInstalled={() => setExtensionInstalled(true)}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
              extensionUrl={extensionUrl}
            />
          )}

          {step === 3 && (
            <SetupStep
              fullName={fullName}
              currentRole={currentRole}
              targetRole={targetRole}
              aiApiKey={aiApiKey}
              onChange={(field, value) => {
                if (field === "fullName") setFullName(value)
                if (field === "currentRole") setCurrentRole(value)
                if (field === "targetRole") setTargetRole(value)
                if (field === "aiApiKey") setAiApiKey(value)
              }}
              onBack={() => goToStep(2)}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  )
}
