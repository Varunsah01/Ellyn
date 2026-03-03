"use client"

import { useEffect, useMemo, useState } from "react"
import { X, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { getOnboardingState, setOnboardingState } from "@/lib/onboarding"

type TourStep = {
  id: string
  title: string
  description: string
  selector: string
}

const tourSteps: TourStep[] = [
  {
    id: "extension",
    title: "Use the Extension on LinkedIn",
    description: "Open any LinkedIn profile and click the Ellyn extension to extract contacts instantly.",
    selector: '[data-tour="extension"]',
  },
  {
    id: "contacts",
    title: "Review Extracted Contacts",
    description: "All captured contacts appear here. You can enrich, tag, and manage them.",
    selector: '[data-tour="contacts"]',
  },
  {
    id: "sequences",
    title: "Create Outreach Sequences",
    description: "Build multi-step email sequences to stay organized and consistent.",
    selector: '[data-tour="sequences"]',
  },
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * Render the DashboardTour component.
 * @returns {unknown} JSX output for DashboardTour.
 * @example
 * <DashboardTour />
 */
export function DashboardTour() {
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})

  const step = tourSteps[stepIndex]

  // Start tour if tourPending flag is set in localStorage
  useEffect(() => {
    const state = getOnboardingState()
    if (state.tourPending && !state.tourDismissed && !state.tourCompleted) {
      setOpen(true)
      setStepIndex(0)
    }
  }, [])

  // Also listen for the imperative start event dispatched after persona selection
  useEffect(() => {
    const handleStartTour = () => {
      const state = getOnboardingState()
      if (!state.tourDismissed && !state.tourCompleted) {
        setOpen(true)
        setStepIndex(0)
      }
    }
    window.addEventListener("ellyn:start-tour", handleStartTour)
    return () => window.removeEventListener("ellyn:start-tour", handleStartTour)
  }, [])

  // Position tooltip next to the highlighted element
  useEffect(() => {
    if (!open || !step) return

    const updatePosition = () => {
      const element = document.querySelector(step.selector)
      const rect = element ? element.getBoundingClientRect() : null
      setTargetRect(rect)

      const tooltipWidth = 320
      const tooltipHeight = 180
      const margin = 16

      if (!rect) {
        setTooltipStyle({
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        })
        return
      }

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const spaceRight = viewportWidth - rect.right
      const spaceLeft = rect.left
      const spaceBottom = viewportHeight - rect.bottom
      const spaceTop = rect.top

      let top = rect.top + rect.height / 2 - tooltipHeight / 2
      let left = rect.right + margin

      if (spaceRight < tooltipWidth + margin && spaceLeft > tooltipWidth + margin) {
        left = rect.left - tooltipWidth - margin
      } else if (spaceRight < tooltipWidth + margin && spaceBottom > tooltipHeight + margin) {
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        top = rect.bottom + margin
      } else if (spaceRight < tooltipWidth + margin && spaceTop > tooltipHeight + margin) {
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        top = rect.top - tooltipHeight - margin
      }

      top = clamp(top, margin, viewportHeight - tooltipHeight - margin)
      left = clamp(left, margin, viewportWidth - tooltipWidth - margin)

      setTooltipStyle({ top, left })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, step])

  // Escape key closes tour
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleDismiss()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleDismiss = () => {
    setOpen(false)
    setOnboardingState({ tourPending: false, tourDismissed: true })
  }

  const handleComplete = () => {
    setOpen(false)
    setOnboardingState({ tourPending: false, tourCompleted: true })
  }

  const nextStep = () => {
    if (stepIndex < tourSteps.length - 1) {
      setStepIndex(stepIndex + 1)
    } else {
      handleComplete()
    }
  }

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1)
    }
  }

  const spotlightStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!targetRect) return undefined
    return {
      top: targetRect.top - 8,
      left: targetRect.left - 8,
      width: targetRect.width + 16,
      height: targetRect.height + 16,
    }
  }, [targetRect])

  if (!open || !step) return null

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60" />
      {targetRect ? (
        <div
          className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
          style={spotlightStyle}
        />
      ) : null}

      <div
        className={cn(
          "absolute w-[320px] max-w-[90vw] rounded-2xl border bg-background shadow-xl p-5 space-y-4"
        )}
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Step {stepIndex + 1} of {tourSteps.length}
            </p>
            <h3 className="text-lg font-semibold">{step.title}</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{step.description}</p>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevStep} disabled={stepIndex === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={nextStep}>
              {stepIndex === tourSteps.length - 1 ? "Finish" : "Next"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
