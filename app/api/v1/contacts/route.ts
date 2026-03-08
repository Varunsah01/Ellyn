import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as ModernRoute from '@/app/api/contacts/route'

const modernConfig = ModernRoute as Record<string, unknown>

export const GET = createVersionedHandler(modernConfig.GET as any)
export const POST = createVersionedHandler(modernConfig.POST as any)
