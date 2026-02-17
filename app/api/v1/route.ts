import { NextResponse } from 'next/server'

/**
 * Handle GET requests for `/api/v1`.
 * @returns {unknown} JSON response for the GET /api/v1 request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/v1
 * fetch('/api/v1')
 */
export async function GET() {
  return NextResponse.json({
    version: '1',
    data: {
      version: '1',
      basePath: '/api/v1',
      status: 'stable',
    },
  })
}

/**
 * Handle POST requests for `/api/v1`.
 * @returns {unknown} JSON response for the POST /api/v1 request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/v1
 * fetch('/api/v1', { method: 'POST' })
 */
export async function POST() {
  return NextResponse.json(
    {
      version: '1',
      data: {
        error: 'Method not allowed. Use GET.',
      },
      error: 'Method not allowed. Use GET.',
    },
    { status: 405 }
  )
}

