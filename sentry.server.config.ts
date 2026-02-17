import * as Sentry from '@sentry/nextjs'

import { getSentryEnvironment, sanitizeSentryEvent } from './lib/monitoring/sentry-sanitize'

const environment = getSentryEnvironment()
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
const isProduction = environment === 'production'

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment,
  sampleRate: isProduction ? 0.9 : 1,
  tracesSampleRate: isProduction ? 0.15 : 0.5,
  beforeSend(event) {
    const sanitized = sanitizeSentryEvent(event)

    if (sanitized.request?.url?.includes('supabase.co')) {
      sanitized.tags = {
        ...sanitized.tags,
        integration: 'supabase',
      }
    }

    return sanitized
  },
})
