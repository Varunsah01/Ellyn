import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/templates/route'

const legacyConfig = LegacyRoute as Record<string, unknown>

export const runtime = legacyConfig.runtime as any
export const preferredRegion = legacyConfig.preferredRegion as any
export const dynamic = legacyConfig.dynamic as any
export const dynamicParams = legacyConfig.dynamicParams as any
export const revalidate = legacyConfig.revalidate as any
export const fetchCache = legacyConfig.fetchCache as any
export const maxDuration = legacyConfig.maxDuration as any

/**
 * Handle GET requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for GET /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/v1/templates
 * fetch('/api/v1/templates', { method: 'GET' })
 */
export const GET = createVersionedHandler(legacyConfig.GET as any)
/**
 * Handle POST requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for POST /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/v1/templates
 * fetch('/api/v1/templates', { method: 'POST' })
 */
export const POST = createVersionedHandler(legacyConfig.POST as any)
/**
 * Handle PUT requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for PUT /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PUT /api/v1/templates
 * fetch('/api/v1/templates', { method: 'PUT' })
 */
export const PUT = createVersionedHandler(legacyConfig.PUT as any)
/**
 * Handle PATCH requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for PATCH /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PATCH /api/v1/templates
 * fetch('/api/v1/templates', { method: 'PATCH' })
 */
export const PATCH = createVersionedHandler(legacyConfig.PATCH as any)
/**
 * Handle DELETE requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for DELETE /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // DELETE /api/v1/templates
 * fetch('/api/v1/templates', { method: 'DELETE' })
 */
export const DELETE = createVersionedHandler(legacyConfig.DELETE as any)
/**
 * Handle OPTIONS requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for OPTIONS /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // OPTIONS /api/v1/templates
 * fetch('/api/v1/templates', { method: 'OPTIONS' })
 */
export const OPTIONS = createVersionedHandler(legacyConfig.OPTIONS as any)
/**
 * Handle HEAD requests for `/api/v1/templates`.
 * @returns {RouteHandler} Versioned route handler for HEAD /api/v1/templates.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // HEAD /api/v1/templates
 * fetch('/api/v1/templates', { method: 'HEAD' })
 */
export const HEAD = createVersionedHandler(legacyConfig.HEAD as any)
