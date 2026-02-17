import * as Sentry from '@sentry/nextjs'

/**
 * Registers Sentry runtime config for node and edge execution contexts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Captures framework-level request handling errors in App Router.
 */
export const onRequestError = Sentry.captureRequestError
