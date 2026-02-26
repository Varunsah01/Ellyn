import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/email-templates/[id]/route'

const legacyConfig = LegacyRoute as Record<string, unknown>


export const GET = createVersionedHandler(legacyConfig.GET as any)
export const PATCH = createVersionedHandler(legacyConfig.PATCH as any)
export const DELETE = createVersionedHandler(legacyConfig.DELETE as any)
