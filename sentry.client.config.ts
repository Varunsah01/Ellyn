import * as Sentry from '@sentry/nextjs'

import { getSentryEnvironment, sanitizeSentryEvent } from './lib/monitoring/sentry-sanitize'

const environment = getSentryEnvironment()
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
const isProduction = environment === 'production'

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment,
  sampleRate: isProduction ? 0.7 : 1,
  tracesSampleRate: isProduction ? 0.1 : 0.5,
  beforeSend(event) {
    return sanitizeSentryEvent(event)
  },
})
