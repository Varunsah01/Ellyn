'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report the error to Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground max-w-md text-sm">
              An unexpected error occurred. Our team has been notified and is looking into it.
            </p>
            {error.digest && (
              <p className="text-muted-foreground font-mono text-xs">Error ID: {error.digest}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={reset} variant="default">
              Try again
            </Button>
            <Button onClick={() => (window.location.href = '/dashboard')} variant="outline">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
