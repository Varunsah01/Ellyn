type ErrorMetadata = Record<string, unknown>

type AppErrorOptions = {
  cause?: unknown
  metadata?: ErrorMetadata
}

export abstract class AppError extends Error {
  readonly statusCode: number
  readonly errorCode: string
  readonly exposeMessage: boolean
  readonly metadata?: ErrorMetadata

  protected constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    exposeMessage = false,
    options?: AppErrorOptions
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.exposeMessage = exposeMessage
    this.metadata = options?.metadata
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', options?: AppErrorOptions) {
    super(message, 401, 'AUTHENTICATION_ERROR', true, options)
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You are not allowed to perform this action', options?: AppErrorOptions) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, options)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', options?: AppErrorOptions) {
    super(message, 400, 'VALIDATION_ERROR', true, options)
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds?: number

  constructor(message = 'Too many requests', retryAfterSeconds?: number, options?: AppErrorOptions) {
    super(message, 429, 'RATE_LIMIT_ERROR', true, options)
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', options?: AppErrorOptions) {
    super(message, 500, 'DATABASE_ERROR', false, options)
  }
}

export class ExternalAPIError extends AppError {
  readonly provider?: string

  constructor(message = 'External API request failed', provider?: string, options?: AppErrorOptions) {
    super(message, 502, 'EXTERNAL_API_ERROR', false, options)
    this.provider = provider
  }
}

