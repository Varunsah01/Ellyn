import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  enabled: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'preview',

  // Lower sample rate on server to control costs
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  // Don't send 4xx errors (client errors, not our bugs)
  // Only capture 5xx server errors
  beforeSend(event) {
    const status = event.tags?.['http.status_code']
    if (status && Number(status) < 500) return null
    return event
  },
})
