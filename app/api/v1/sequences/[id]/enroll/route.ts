import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as ModernRoute from '@/app/api/sequences/[id]/enroll/route'

const modernConfig = ModernRoute as Record<string, unknown>

export const POST = createVersionedHandler(modernConfig.POST as any)
