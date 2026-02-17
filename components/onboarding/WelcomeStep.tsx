"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface WelcomeStepProps {
  onNext: () => void
}

/**
 * Render the WelcomeStep component.
 * @param {WelcomeStepProps} props - Component props.
 * @returns {unknown} JSX output for WelcomeStep.
 * @example
 * <WelcomeStep />
 */
export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Welcome
        </div>
        <h1 className="text-4xl md:text-5xl font-fraunces font-bold">
          Welcome to Ellyn - Your Job Search Assistant
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Ellyn helps you extract contacts, craft outreach, and track results.
          Lets get you set up in under two minutes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Extract",
            description: "Grab contacts straight from LinkedIn in one click.",
          },
          {
            title: "Draft",
            description: "Generate polished outreach emails with AI.",
          },
          {
            title: "Send",
            description: "Launch sequences and monitor replies in one place.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border bg-card p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onNext} size="lg">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground">
          No credit card required.
        </p>
      </div>
    </div>
  )
}
