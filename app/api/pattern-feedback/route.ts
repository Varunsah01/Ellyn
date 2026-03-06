import { NextRequest } from 'next/server'

import {
  handlePatternFeedbackPost,
  methodNotAllowedResponse,
} from '@/lib/pattern-feedback-endpoint'

/**
 * Handle POST requests for `/api/pattern-feedback`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/pattern-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/pattern-feedback
 * fetch('/api/pattern-feedback', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  return handlePatternFeedbackPost(request, {
    route: '/api/pattern-feedback',
    rateLimitKey: 'pattern-feedback',
  })
}

// Handle unsupported methods
/**
 * Handle GET requests for `/api/pattern-feedback`.
 * @returns {unknown} JSON response for the GET /api/pattern-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/pattern-feedback
 * fetch('/api/pattern-feedback')
 */
export async function GET() {
  return methodNotAllowedResponse()
}
