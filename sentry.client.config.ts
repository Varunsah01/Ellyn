import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production and staging
  enabled: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'preview',

  // Capture 10% of transactions for performance monitoring
  // Increase to 1.0 for debugging, lower in high-traffic production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // GDPR: mask all text by default
      blockAllMedia: true, // GDPR: block media recordings
    }),
  ],

  // Ignore common non-actionable errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error exception captured',
    /^Network request failed$/,
    /^Load failed$/,
    /^Cancelled$/,
    /ChunkLoadError/,
  ],

  beforeSend(event) {
    // Scrub sensitive data before sending
    if (event.request?.headers) {
      delete event.request.headers.Authorization
      delete event.request.headers.Cookie
      delete event.request.headers['X-Supabase-Auth']
    }
    return event
  },
})
