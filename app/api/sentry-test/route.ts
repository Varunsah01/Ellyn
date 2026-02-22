import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

// GET /api/sentry-test - Deliberately throw an error to verify Sentry is working
// DELETE THIS FILE before going to production
export async function GET() {
  try {
    throw new Error(
      '[ELLYN] Sentry test error - if you see this in Sentry, monitoring is working!'
    )
  } catch (error) {
    Sentry.captureException(error)
    return NextResponse.json({
      message: 'Test error sent to Sentry. Check your Sentry dashboard.',
      timestamp: new Date().toISOString(),
    })
  }
}
