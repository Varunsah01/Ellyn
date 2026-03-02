import * as Sentry from '@sentry/nextjs'

import './sentry.client.config'

/**
 * Captures client-side route transitions for performance traces.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRouterTransitionStart = (Sentry as any).captureRouterTransitionStart
