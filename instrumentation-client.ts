import * as Sentry from '@sentry/nextjs'

import './sentry.client.config'

/**
 * Captures client-side route transitions for performance traces.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
