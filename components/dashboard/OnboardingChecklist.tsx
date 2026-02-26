"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, X, HelpCircle } from "lucide-react"
import { usePersona } from "@/context/PersonaContext"

const CHECKLIST_DISMISSED_KEY = "ellyn_checklist_dismissed"

type Step = {
  id: string
  label: string
  href: string
  external?: boolean
}

const STEPS: Step[] = [
  { id: "persona_selected", label: "Choose your goal", href: "/dashboard" },
  {
    id: "extension_installed",
    label: "Install Chrome extension",
    href: "https://chromewebstore.google.com",
    external: true,
  },
  { id: "first_contact", label: "Find your first contact", href: "/dashboard/contacts" },
  { id: "first_draft", label: "Write an email draft", href: "/dashboard" },
  { id: "first_sequence", label: "Create a sequence", href: "/dashboard/sequences" },
]

export function OnboardingChecklist() {
  const { isLoading, onboardingStepsCompleted, onboardingCompleted } = usePersona()
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [showComplete, setShowComplete] = useState(false)

  // Read dismissed state from localStorage after mount
  useEffect(() => {
    try {
      const val = localStorage.getItem(CHECKLIST_DISMISSED_KEY)
      setDismissed(val === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  // Auto-dismiss when all steps completed
  useEffect(() => {
    if (!onboardingCompleted || dismissed) return
    setShowComplete(true)
    const timer = setTimeout(dismissForever, 3000)
    return () => clearTimeout(timer)
  }, [onboardingCompleted, dismissed])

  const dismissForever = () => {
    try {
      localStorage.setItem(CHECKLIST_DISMISSED_KEY, "1")
    } catch {
      // localStorage unavailable
    }
    setDismissed(true)
  }

  // Don't render until auth check + dismissed state resolved
  if (isLoading || dismissed === null) return null
  // Don't show at all if permanently dismissed (unless user re-opens)
  // (collapsed=true means show the ? button instead)

  const completedIds = new Set(onboardingStepsCompleted)
  const completedCount = STEPS.filter((s) => completedIds.has(s.id)).length
  const progressPercent = Math.round((completedCount / STEPS.length) * 100)

  // Determine animation delay: if modal is likely showing, delay checklist more
  let modalLikelyShowing = false
  try {
    modalLikelyShowing = !localStorage.getItem("ellyn_persona_onboarded")
  } catch {
    // ignore
  }
  const animationDelay = modalLikelyShowing ? 1.8 : 0.5

  // If permanently dismissed, show the ? re-open button
  if (dismissed) {
    return (
      <AnimatePresence>
        <motion.button
          key="reopen"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => setDismissed(false)}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-lg text-white"
          style={{ backgroundColor: "#7C3AED" }}
          aria-label="Open onboarding checklist"
        >
          <HelpCircle className="h-5 w-5" />
        </motion.button>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        key="checklist"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.4, delay: animationDelay }}
        className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {showComplete ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                <Check className="h-3.5 w-3.5 text-green-600" />
              </div>
            ) : null}
            <span className="text-sm font-semibold text-gray-800">
              {showComplete ? "All done!" : `Getting started · ${completedCount}/${STEPS.length}`}
            </span>
          </div>
          <button
            onClick={dismissForever}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              style={{ width: `${progressPercent}%`, backgroundColor: "#7C3AED" }}
              className="h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>

        {/* Steps */}
        <ul className="px-4 pb-4 space-y-2">
          {STEPS.map((step) => {
            const done = completedIds.has(step.id)
            return (
              <li key={step.id} className="flex items-center gap-3">
                {done ? (
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <Check className="h-3 w-3 text-purple-600" />
                  </div>
                ) : (
                  <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-gray-300" />
                )}
                {done ? (
                  <span className="text-sm text-gray-400 line-through">{step.label}</span>
                ) : (
                  <a
                    href={step.href}
                    target={step.external ? "_blank" : undefined}
                    rel={step.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-gray-700 hover:text-purple-700 hover:underline transition-colors"
                  >
                    {step.label}
                  </a>
                )}
              </li>
            )
          })}
        </ul>

        {/* Dismiss link */}
        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <button
            onClick={dismissForever}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Dismiss forever
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
