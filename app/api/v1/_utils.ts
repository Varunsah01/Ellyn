import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors/error-handler'
import { monitorApiRoute } from '@/lib/monitoring/performance'

type RouteHandler<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => Promise<Response> | Response

function isObjectPayload(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
}

function isVersionedPayload(payload: unknown): boolean {
  return (
    isObjectPayload(payload) &&
    typeof payload.version === 'string' &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  )
}

function buildVersionedPayload(payload: unknown) {
  if (isObjectPayload(payload)) {
    return {
      version: '1',
      data: payload,
      ...payload,
    }
  }

  return {
    version: '1',
    data: payload,
  }
}

async function wrapVersionedResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers)
  headers.set('X-API-Version', '1')

  const contentType = (headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('application/json')) {
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  let payload: unknown
  try {
    payload = await response.clone().json()
  } catch {
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  if (response.status >= 500) {
    headers.delete('content-length')
    return NextResponse.json(
      {
        version: '1',
        data: {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
      {
        status: response.status,
        headers,
      }
    )
  }

  if (isVersionedPayload(payload)) {
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  headers.delete('content-length')
  return NextResponse.json(buildVersionedPayload(payload), {
    status: response.status,
    headers,
  })
}

/**
 * Wraps a route handler to enforce v1 API response shape and error normalization.
 * @param {RouteHandler | undefined} handler - Route handler implementation for a specific HTTP method.
 * @returns {RouteHandler} Wrapped handler that adds API version metadata and consistent JSON error responses.
 * @throws {Error} Propagates unexpected runtime failures through `handleApiError`.
 * @example
 * const GET = createVersionedHandler(async () => NextResponse.json({ success: true }))
 */
export function createVersionedHandler<TArgs extends unknown[]>(handler?: RouteHandler<TArgs>): RouteHandler<TArgs> {
  return async (...args: TArgs) => {
    const requestLike = args[0] as { nextUrl?: { pathname?: string }; method?: string } | undefined
    const route = requestLike?.nextUrl?.pathname || '/api/v1/unknown'
    const method = String(requestLike?.method || 'UNKNOWN').toUpperCase()

    return monitorApiRoute(route, method, async () => {
      if (typeof handler !== 'function') {
        return NextResponse.json(
          {
            version: '1',
            data: {
              error: 'Method not allowed.',
            },
            error: 'Method not allowed.',
          },
          { status: 405 }
        )
      }

      try {
        const response = await handler(...args)
        return wrapVersionedResponse(response)
      } catch (error) {
        return handleApiError(error, {
          route,
          method,
          version: '1',
        })
      }
    })
  }
}
