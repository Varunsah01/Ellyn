import { NextRequest } from 'next/server'

import {
  handlePatternFeedbackPost,
  methodNotAllowedResponse,
} from '@/lib/pattern-feedback-endpoint'

/**
 * Handle POST requests for `/api/email-feedback`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/email-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/email-feedback
 * fetch('/api/email-feedback', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  return handlePatternFeedbackPost(request, {
    route: '/api/email-feedback',
    rateLimitKey: 'email-feedback',
  })
}

/**
 * Handle GET requests for `/api/email-feedback`.
 * @returns {unknown} JSON response for the GET /api/email-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/email-feedback
 * fetch('/api/email-feedback')
 */
export async function GET() {
  return methodNotAllowedResponse()
}
