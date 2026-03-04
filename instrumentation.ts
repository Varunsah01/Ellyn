import * as Sentry from '@sentry/nextjs'

/**
 * Registers Sentry runtime config for node and edge execution contexts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    const { validateEnv } = await import('@/lib/env')
    validateEnv()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Captures framework-level request handling errors in App Router.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRequestError = (Sentry as any).captureRequestError
