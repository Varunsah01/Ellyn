import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/sequences/[id]/stats/route'

const legacyConfig = LegacyRoute as Record<string, unknown>


export const GET = createVersionedHandler(legacyConfig.GET as any)
