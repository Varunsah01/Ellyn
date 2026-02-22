import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'preview',
  tracesSampleRate: 0.05,
})
