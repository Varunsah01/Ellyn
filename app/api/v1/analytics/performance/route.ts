import { createVersionedHandler } from '@/app/api/v1/_utils'
import { type NextRequest } from 'next/server'
import { GET as LegacyGet, POST as LegacyPost } from '@/app/api/analytics/performance/route'

export { dynamic } from '@/app/api/analytics/performance/route'

export const GET = createVersionedHandler((request: unknown) =>
  LegacyGet(request as NextRequest)
)
export const POST = createVersionedHandler((request: unknown) =>
  LegacyPost(request as NextRequest)
)
