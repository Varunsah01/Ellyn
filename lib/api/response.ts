import { NextResponse } from 'next/server'

type ApiSuccess<T> = { data: T; error: null }
type ApiError = { data: null; error: string; code?: string }

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data, error: null }, { status })
}

export function err(message: string, status = 400, code?: string): NextResponse<ApiError> {
  return NextResponse.json({ data: null, error: message, code }, { status })
}

export function unauthorized() {
  return err('Unauthorized', 401, 'unauthorized')
}

export function notFound(entity = 'Resource') {
  return err(`${entity} not found`, 404, 'not_found')
}

export function forbidden(message = 'Forbidden') {
  return err(message, 403, 'forbidden')
}

export function quotaExceeded(
  feature: string,
  used: number,
  limit: number,
  planType: string
) {
  return NextResponse.json(
    {
      data: null,
      error: 'quota_exceeded',
      feature,
      used,
      limit,
      plan_type: planType,
      upgrade_url: '/dashboard/upgrade',
    },
    { status: 402 }
  )
}

export function validationError(issues: unknown) {
  return NextResponse.json(
    {
      data: null,
      error: 'Validation failed',
      code: 'validation_error',
      issues,
    },
    { status: 422 }
  )
}
