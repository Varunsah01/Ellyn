import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/sequences/[id]/enrollments/[enrollmentId]/remove/route'

const legacyConfig = LegacyRoute as Record<string, unknown>


export const POST = createVersionedHandler(legacyConfig.POST as any)
