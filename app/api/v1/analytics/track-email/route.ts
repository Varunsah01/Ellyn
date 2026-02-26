import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/analytics/track-email/route'

const legacyConfig = LegacyRoute as Record<string, unknown>


export const GET = createVersionedHandler(legacyConfig.GET as any)
export const POST = createVersionedHandler(legacyConfig.POST as any)
export const PUT = createVersionedHandler(legacyConfig.PUT as any)
export const PATCH = createVersionedHandler(legacyConfig.PATCH as any)
export const DELETE = createVersionedHandler(legacyConfig.DELETE as any)
export const OPTIONS = createVersionedHandler(legacyConfig.OPTIONS as any)
export const HEAD = createVersionedHandler(legacyConfig.HEAD as any)
