'use client'

import { useReportWebVitals } from 'next/web-vitals'

import { trackWebVital } from '@/app/web-vitals'

/**
 * Subscribes to Core Web Vitals in the browser and forwards them to analytics.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    trackWebVital(metric)
  })

  return null
}
