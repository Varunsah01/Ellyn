import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/email-feedback/route'

const legacyConfig = LegacyRoute as Record<string, unknown>


/**
 * Handle GET requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for GET /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'GET' })
 */
export const GET = createVersionedHandler(legacyConfig.GET as any)
/**
 * Handle POST requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for POST /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'POST' })
 */
export const POST = createVersionedHandler(legacyConfig.POST as any)
/**
 * Handle PUT requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for PUT /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PUT /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'PUT' })
 */
export const PUT = createVersionedHandler(legacyConfig.PUT as any)
/**
 * Handle PATCH requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for PATCH /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PATCH /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'PATCH' })
 */
export const PATCH = createVersionedHandler(legacyConfig.PATCH as any)
/**
 * Handle DELETE requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for DELETE /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // DELETE /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'DELETE' })
 */
export const DELETE = createVersionedHandler(legacyConfig.DELETE as any)
/**
 * Handle OPTIONS requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for OPTIONS /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // OPTIONS /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'OPTIONS' })
 */
export const OPTIONS = createVersionedHandler(legacyConfig.OPTIONS as any)
/**
 * Handle HEAD requests for `/api/v1/email-feedback`.
 * @returns {RouteHandler} Versioned route handler for HEAD /api/v1/email-feedback.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // HEAD /api/v1/email-feedback
 * fetch('/api/v1/email-feedback', { method: 'HEAD' })
 */
export const HEAD = createVersionedHandler(legacyConfig.HEAD as any)
