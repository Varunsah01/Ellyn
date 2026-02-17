import { withCsrfHeaders } from '@/lib/csrf'

export const API_VERSION = '1' as const
export const API_BASE_PATH = `/api/v${API_VERSION}` as const

/**
 * To versioned api path.
 * @param {string} path - Path input.
 * @returns {string} Computed string.
 * @example
 * toVersionedApiPath('path')
 */
export function toVersionedApiPath(path: string): string {
  if (!path) return API_BASE_PATH
  if (path.startsWith('/api/v')) return path
  if (path.startsWith('/api/')) return path.replace(/^\/api\//, `/api/v${API_VERSION}/`)
  if (path.startsWith('/')) return `${API_BASE_PATH}${path}`
  return `${API_BASE_PATH}/${path}`
}

/**
 * Api fetch.
 * @param {string} input - Input input.
 * @param {RequestInit} init - Init input.
 * @returns {Promise<Response>} Computed Promise<Response>.
 * @throws {Error} If the operation fails.
 * @example
 * apiFetch('input', request)
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(toVersionedApiPath(input), withCsrfHeaders(init))
}

export type VersionedApiResponse<T> = {
  version: string
  data: T
}
