import { createVersionedHandler } from '@/app/api/v1/_utils'
import * as LegacyRoute from '@/app/api/sequences/reply/route'

const legacyConfig = LegacyRoute as Record<string, unknown>

export const runtime = legacyConfig.runtime as any
export const preferredRegion = legacyConfig.preferredRegion as any
export const dynamic = legacyConfig.dynamic as any
export const dynamicParams = legacyConfig.dynamicParams as any
export const revalidate = legacyConfig.revalidate as any
export const fetchCache = legacyConfig.fetchCache as any
export const maxDuration = legacyConfig.maxDuration as any

export const POST = createVersionedHandler(legacyConfig.POST as any)
