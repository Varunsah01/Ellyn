import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as ModernRoute from '@/app/api/contacts/[id]/route'

const modernConfig = ModernRoute as Record<string, unknown>

export const GET = createVersionedHandler(modernConfig.GET as any)
export const PUT = createVersionedHandler(modernConfig.PUT as any)
export const PATCH = createVersionedHandler(modernConfig.PATCH as any)
export const DELETE = createVersionedHandler(modernConfig.DELETE as any)
