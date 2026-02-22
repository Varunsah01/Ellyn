import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Forward extension errors to Sentry with extension context
    Sentry.withScope((scope) => {
      scope.setTag('source', 'chrome-extension')
      scope.setTag('extension.version', body.context?.extensionVersion || 'unknown')
      scope.setExtra('context', body.context || {})

      const error = new Error(body.message || 'Unknown extension error')
      error.stack = body.stack || error.stack
      Sentry.captureException(error)
    })

    return NextResponse.json({ received: true })
  } catch {
    // Never let this endpoint error - it would create an infinite loop
    return NextResponse.json({ received: false }, { status: 200 })
  }
}
