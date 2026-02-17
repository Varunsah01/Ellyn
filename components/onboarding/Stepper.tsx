"use client"

import { cn } from "@/lib/utils"

const steps = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Extension" },
  { id: 3, label: "Quick Setup" },
]

interface StepperProps {
  currentStep: number
}

/**
 * Render the OnboardingStepper component.
 * @param {StepperProps} props - Component props.
 * @returns {unknown} JSX output for OnboardingStepper.
 * @example
 * <OnboardingStepper />
 */
export function OnboardingStepper({ currentStep }: StepperProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isComplete = step.id < currentStep
          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border",
                    isComplete && "bg-primary text-primary-foreground border-primary",
                    isActive && "border-primary text-primary",
                    !isActive && !isComplete && "text-muted-foreground"
                  )}
                >
                  {step.id}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive && "text-foreground",
                    !isActive && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-px bg-border mx-4" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
