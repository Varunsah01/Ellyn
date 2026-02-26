import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/email-templates/[id]/route'

const legacyConfig = LegacyRoute as Record<string, unknown>

export const runtime = legacyConfig.runtime as any
export const preferredRegion = legacyConfig.preferredRegion as any
export const dynamic = legacyConfig.dynamic as any
export const dynamicParams = legacyConfig.dynamicParams as any
export const revalidate = legacyConfig.revalidate as any
export const fetchCache = legacyConfig.fetchCache as any
export const maxDuration = legacyConfig.maxDuration as any

export const GET = createVersionedHandler(legacyConfig.GET as any)
export const PATCH = createVersionedHandler(legacyConfig.PATCH as any)
export const DELETE = createVersionedHandler(legacyConfig.DELETE as any)
