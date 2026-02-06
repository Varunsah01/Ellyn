"use client"

import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ExtensionStepProps {
  extensionInstalled: boolean
  onInstall: () => void
  onConfirmInstalled: () => void
  onBack: () => void
  onNext: () => void
  extensionUrl: string
}

export function ExtensionStep({
  extensionInstalled,
  onInstall,
  onConfirmInstalled,
  onBack,
  onNext,
  extensionUrl,
}: ExtensionStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-fraunces font-bold">
          Install the Ellyn Chrome Extension
        </h2>
        <p className="text-muted-foreground">
          Capture contacts from LinkedIn profiles and send them straight to your dashboard.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Chrome Web Store</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Install and pin the extension for quick access.
            </p>
          </div>
          {extensionInstalled && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Extension installed
            </div>
          )}
        </div>

        {!extensionInstalled ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={onInstall} asChild>
              <a href={extensionUrl} target="_blank" rel="noreferrer">
                Install Extension
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" onClick={onConfirmInstalled}>
              I already installed it
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Nice work! Next, lets capture your first contact.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
