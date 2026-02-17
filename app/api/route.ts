import { NextResponse } from 'next/server'

/**
 * Handle GET requests for `/api`.
 * @returns {unknown} JSON response for the GET /api request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api
 * fetch('/api')
 */
export async function GET() {
  return NextResponse.json({
    version: '1',
    data: {
      currentVersion: '1',
      latestVersion: '1',
      basePath: '/api/v1',
      legacyBasePath: '/api',
      status: 'stable',
    },
  })
}

/**
 * Handle POST requests for `/api`.
 * @returns {unknown} JSON response for the POST /api request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api
 * fetch('/api', { method: 'POST' })
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

