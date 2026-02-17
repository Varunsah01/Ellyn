import { createClient, kv as defaultKv, type VercelKV } from '@vercel/kv'

type CacheEnvelope<T> = {
  value: T
  _meta: {
    storedAt: number
    ttlSeconds: number
    tags: string[]
  }
}

type CacheSetOptions = {
  tags?: string[]
}

type BackgroundRefreshOptions = {
  enabled?: boolean
  hotThreshold?: number
  refreshAheadSeconds?: number
  cooldownSeconds?: number
}

type GetOrSetOptions<T> = {
  key: string
  ttlSeconds: number
  tags?: string[]
  fetcher: () => Promise<T>
  cacheNull?: boolean
  nullTtlSeconds?: number
  backgroundRefresh?: BackgroundRefreshOptions
}

type MemoryEntry = {
  payload: unknown
  expiresAt: number
  tags: Set<string>
}

type HotKeyState = {
  hits: number
  inFlight: boolean
  lastRefreshAt: number
}

type CacheCounters = {
  hits: number
  misses: number
  sets: number
  deletes: number
  clears: number
  errors: number
  refreshes: number
}

type CacheMetricsStore = {
  totals: CacheCounters
  namespaces: Map<string, CacheCounters>
  updatedAt: number
}

type GlobalCacheState = typeof globalThis & {
  __ellynCacheMemoryStore?: Map<string, MemoryEntry>
  __ellynCacheTagIndex?: Map<string, Set<string>>
  __ellynCacheHotKeys?: Map<string, HotKeyState>
  __ellynCacheMetrics?: CacheMetricsStore
}

type ReadResult<T> = {
  hit: boolean
  value: T | null
}

const MIN_TTL_SECONDS = 1
const DEFAULT_NULL_TTL_SECONDS = 300
const DEFAULT_HOT_THRESHOLD = 10
const DEFAULT_REFRESH_AHEAD_SECONDS = 300
const DEFAULT_REFRESH_COOLDOWN_SECONDS = 120
const TAG_INDEX_PREFIX = 'cache:tag:'
const KEY_TAG_INDEX_PREFIX = 'cache:keytags:'
const TAG_SET_EXTRA_TTL_SECONDS = 24 * 60 * 60

let redisClient: VercelKV | null | undefined

function getGlobalState(): GlobalCacheState {
  return globalThis as GlobalCacheState
}

function createEmptyCounters(): CacheCounters {
  return {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    clears: 0,
    errors: 0,
    refreshes: 0,
  }
}

function getMetricsStore(): CacheMetricsStore {
  const globalState = getGlobalState()
  if (!globalState.__ellynCacheMetrics) {
    globalState.__ellynCacheMetrics = {
      totals: createEmptyCounters(),
      namespaces: new Map<string, CacheCounters>(),
      updatedAt: Date.now(),
    }
  }
  return globalState.__ellynCacheMetrics
}

function getMemoryStore(): Map<string, MemoryEntry> {
  const globalState = getGlobalState()
  if (!globalState.__ellynCacheMemoryStore) {
    globalState.__ellynCacheMemoryStore = new Map<string, MemoryEntry>()
  }
  return globalState.__ellynCacheMemoryStore
}

function getMemoryTagIndex(): Map<string, Set<string>> {
  const globalState = getGlobalState()
  if (!globalState.__ellynCacheTagIndex) {
    globalState.__ellynCacheTagIndex = new Map<string, Set<string>>()
  }
  return globalState.__ellynCacheTagIndex
}

function getHotKeyMap(): Map<string, HotKeyState> {
  const globalState = getGlobalState()
  if (!globalState.__ellynCacheHotKeys) {
    globalState.__ellynCacheHotKeys = new Map<string, HotKeyState>()
  }
  return globalState.__ellynCacheHotKeys
}

function namespaceFromKey(key: string): string {
  const parts = key.split(':').filter(Boolean)
  if (parts.length >= 2 && parts[0] === 'cache') {
    return parts[1] || 'default'
  }
  return parts[0] || 'default'
}

function incrementMetric(counter: keyof CacheCounters, key: string) {
  const store = getMetricsStore()
  store.totals[counter] += 1

  const namespace = namespaceFromKey(key)
  const namespaceCounters = store.namespaces.get(namespace) || createEmptyCounters()
  namespaceCounters[counter] += 1
  store.namespaces.set(namespace, namespaceCounters)
  store.updatedAt = Date.now()
}

function normalizeTtlSeconds(value: number): number {
  const ttl = Math.trunc(Number(value))
  if (!Number.isFinite(ttl) || ttl < MIN_TTL_SECONDS) {
    return MIN_TTL_SECONDS
  }
  return ttl
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return []

  const unique = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeCacheToken(tag)
    if (normalized) unique.add(normalized)
  }

  return [...unique]
}

function keyTagIndexKey(cacheKey: string): string {
  return `${KEY_TAG_INDEX_PREFIX}${cacheKey}`
}

function tagIndexKey(tag: string): string {
  return `${TAG_INDEX_PREFIX}${tag}`
}

function cleanupMemoryTagEntry(tag: string, key: string) {
  const tagIndex = getMemoryTagIndex()
  const keys = tagIndex.get(tag)
  if (!keys) return
  keys.delete(key)
  if (keys.size === 0) {
    tagIndex.delete(tag)
  }
}

function deleteFromMemoryOnly(key: string): boolean {
  const store = getMemoryStore()
  const existing = store.get(key)
  if (!existing) {
    return false
  }

  for (const tag of existing.tags) {
    cleanupMemoryTagEntry(tag, key)
  }

  store.delete(key)
  return true
}

function writeToMemory(key: string, payload: unknown, ttlSeconds: number, tags: string[]) {
  const store = getMemoryStore()
  const existing = store.get(key)
  if (existing) {
    for (const tag of existing.tags) {
      cleanupMemoryTagEntry(tag, key)
    }
  }

  const normalizedTags = new Set(tags)
  const entry: MemoryEntry = {
    payload,
    expiresAt: Date.now() + ttlSeconds * 1000,
    tags: normalizedTags,
  }

  store.set(key, entry)

  const tagIndex = getMemoryTagIndex()
  for (const tag of normalizedTags) {
    const keys = tagIndex.get(tag) || new Set<string>()
    keys.add(key)
    tagIndex.set(tag, keys)
  }
}

function parsePayload<T>(value: unknown): T | null {
  if (isCacheEnvelope(value)) {
    return (value.value as T) ?? null
  }

  return (value as T) ?? null
}

function isCacheEnvelope(value: unknown): value is CacheEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false
  const asObj = value as Record<string, unknown>
  return 'value' in asObj && '_meta' in asObj
}

function compactError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

function getRedisClient(): VercelKV | null {
  if (redisClient !== undefined) {
    return redisClient
  }

  const primaryUrl = process.env.KV_REST_API_URL?.trim()
  const primaryToken = process.env.KV_REST_API_TOKEN?.trim()

  const fallbackUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const fallbackToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  const url = primaryUrl || fallbackUrl
  const token = primaryToken || fallbackToken

  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  try {
    redisClient = createClient({
      url,
      token,
      automaticDeserialization: true,
    })
  } catch (error) {
    console.warn('[Cache] Failed to initialize Redis client, using in-memory fallback:', compactError(error))
    redisClient = null
  }

  if (!redisClient && primaryUrl && primaryToken) {
    redisClient = defaultKv
  }

  return redisClient
}

async function readFromMemory<T>(key: string): Promise<ReadResult<T>> {
  const store = getMemoryStore()
  const entry = store.get(key)
  if (!entry) {
    return { hit: false, value: null }
  }

  if (Date.now() >= entry.expiresAt) {
    deleteFromMemoryOnly(key)
    return { hit: false, value: null }
  }

  return {
    hit: true,
    value: parsePayload<T>(entry.payload),
  }
}

async function readFromCache<T>(key: string): Promise<ReadResult<T>> {
  const redis = getRedisClient()
  if (redis) {
    try {
      const value = await redis.get<CacheEnvelope<T> | T>(key)
      if (value !== null && value !== undefined) {
        return {
          hit: true,
          value: parsePayload<T>(value),
        }
      }
    } catch (error) {
      incrementMetric('errors', key)
      console.warn('[Cache] Redis get failed, falling back to memory:', {
        key,
        error: compactError(error),
      })
    }
  }

  return readFromMemory<T>(key)
}

async function readWithMetrics<T>(key: string): Promise<ReadResult<T>> {
  const result = await readFromCache<T>(key)
  incrementMetric(result.hit ? 'hits' : 'misses', key)
  if (result.hit) {
    const hotKeys = getHotKeyMap()
    const state = hotKeys.get(key) || {
      hits: 0,
      inFlight: false,
      lastRefreshAt: 0,
    }
    state.hits += 1
    hotKeys.set(key, state)
  }
  return result
}

async function getRemainingTtlSeconds(key: string): Promise<number | null> {
  const redis = getRedisClient()
  if (redis) {
    try {
      const ttl = await redis.ttl(key)
      if (typeof ttl === 'number' && ttl >= 0) {
        return ttl
      }
    } catch (error) {
      incrementMetric('errors', key)
      console.warn('[Cache] Redis ttl lookup failed:', {
        key,
        error: compactError(error),
      })
    }
  }

  const memoryEntry = getMemoryStore().get(key)
  if (!memoryEntry) return null
  const remainingMs = memoryEntry.expiresAt - Date.now()
  if (remainingMs <= 0) return 0
  return Math.ceil(remainingMs / 1000)
}

async function getTagsForRedisKey(redis: VercelKV, cacheKey: string): Promise<string[]> {
  try {
    const tags = await redis.smembers<string[]>(keyTagIndexKey(cacheKey))
    if (!Array.isArray(tags)) return []
    return tags
      .map((tag) => normalizeCacheToken(tag))
      .filter(Boolean)
  } catch (error) {
    incrementMetric('errors', cacheKey)
    console.warn('[Cache] Redis key tag lookup failed:', {
      key: cacheKey,
      error: compactError(error),
    })
    return []
  }
}

async function updateRedisTagIndexes(redis: VercelKV, cacheKey: string, tags: string[], ttlSeconds: number) {
  const keyTagKey = keyTagIndexKey(cacheKey)
  await redis.del(keyTagKey)

  if (tags.length === 0) return

  for (const tag of tags) {
    await redis.sadd(keyTagKey, tag)
  }
  await redis.expire(keyTagKey, ttlSeconds + TAG_SET_EXTRA_TTL_SECONDS)

  for (const tag of tags) {
    const tagKey = tagIndexKey(tag)
    await redis.sadd(tagKey, cacheKey)
    await redis.expire(tagKey, Math.max(ttlSeconds + TAG_SET_EXTRA_TTL_SECONDS, 7 * 24 * 60 * 60))
  }
}

async function removeRedisTagIndexes(redis: VercelKV, cacheKey: string) {
  const tags = await getTagsForRedisKey(redis, cacheKey)
  for (const tag of tags) {
    await redis.srem(tagIndexKey(tag), cacheKey)
  }
  await redis.del(keyTagIndexKey(cacheKey))
}

function globPatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

async function maybeRefreshHotKey<T>(
  key: string,
  ttlSeconds: number,
  tags: string[],
  fetcher: () => Promise<T>,
  cacheNull: boolean,
  nullTtlSeconds: number,
  refreshOptions: BackgroundRefreshOptions | undefined
) {
  if (refreshOptions?.enabled === false) return

  const hotThreshold = Math.max(1, refreshOptions?.hotThreshold ?? DEFAULT_HOT_THRESHOLD)
  const refreshAheadSeconds = Math.max(1, refreshOptions?.refreshAheadSeconds ?? DEFAULT_REFRESH_AHEAD_SECONDS)
  const cooldownSeconds = Math.max(1, refreshOptions?.cooldownSeconds ?? DEFAULT_REFRESH_COOLDOWN_SECONDS)

  const hotKeys = getHotKeyMap()
  const state = hotKeys.get(key)
  if (!state) return
  if (state.hits < hotThreshold) return
  if (state.inFlight) return

  const remainingTtl = await getRemainingTtlSeconds(key)
  if (remainingTtl === null || remainingTtl > refreshAheadSeconds) return

  const now = Date.now()
  if (now - state.lastRefreshAt < cooldownSeconds * 1000) return

  state.inFlight = true
  state.lastRefreshAt = now
  hotKeys.set(key, state)

  void (async () => {
    try {
      const refreshedValue = await fetcher()
      const shouldCache = refreshedValue !== null && refreshedValue !== undefined ? true : cacheNull
      if (shouldCache) {
        const appliedTtl =
          refreshedValue === null || refreshedValue === undefined
            ? normalizeTtlSeconds(nullTtlSeconds)
            : ttlSeconds
        await set(key, refreshedValue, appliedTtl, { tags })
      }
      incrementMetric('refreshes', key)
    } catch (error) {
      incrementMetric('errors', key)
      console.warn('[Cache] Background refresh failed:', {
        key,
        error: compactError(error),
      })
    } finally {
      const latest = hotKeys.get(key)
      if (latest) {
        latest.inFlight = false
        latest.hits = 0
        hotKeys.set(key, latest)
      }
    }
  })()
}

/**
 * Normalize and sanitize cache key/token fragments.
 */
export function normalizeCacheToken(value: string | number | boolean | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Build stable cache keys from multiple fragments.
 */
export function buildCacheKey(parts: Array<string | number | boolean | null | undefined>): string {
  const tokens = parts.map((part) => normalizeCacheToken(part)).filter(Boolean)
  return tokens.join(':')
}

/**
 * Read a cache entry by key.
 */
export async function get<T = unknown>(key: string): Promise<T | null> {
  const cacheKey = String(key || '').trim()
  if (!cacheKey) return null

  const result = await readWithMetrics<T>(cacheKey)
  return result.value
}

/**
 * Write a cache entry with TTL and optional tags.
 */
export async function set<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  options?: CacheSetOptions
): Promise<boolean> {
  const cacheKey = String(key || '').trim()
  if (!cacheKey) return false

  const ttl = normalizeTtlSeconds(ttlSeconds)
  const tags = normalizeTags(options?.tags)

  const envelope: CacheEnvelope<T> = {
    value,
    _meta: {
      storedAt: Date.now(),
      ttlSeconds: ttl,
      tags,
    },
  }

  const redis = getRedisClient()
  if (redis) {
    try {
      await redis.set(cacheKey, envelope, { ex: ttl })
      await updateRedisTagIndexes(redis, cacheKey, tags, ttl)
    } catch (error) {
      incrementMetric('errors', cacheKey)
      console.warn('[Cache] Redis set failed, using memory fallback:', {
        key: cacheKey,
        error: compactError(error),
      })
    }
  }

  writeToMemory(cacheKey, envelope, ttl, tags)
  incrementMetric('sets', cacheKey)
  return true
}

/**
 * Delete a cache key.
 */
export async function deleteKey(key: string): Promise<boolean> {
  const cacheKey = String(key || '').trim()
  if (!cacheKey) return false

  let deleted = false
  const redis = getRedisClient()
  if (redis) {
    try {
      await removeRedisTagIndexes(redis, cacheKey)
      const count = await redis.del(cacheKey)
      if (Number(count) > 0) {
        deleted = true
      }
    } catch (error) {
      incrementMetric('errors', cacheKey)
      console.warn('[Cache] Redis delete failed, continuing with memory fallback:', {
        key: cacheKey,
        error: compactError(error),
      })
    }
  }

  deleted = deleteFromMemoryOnly(cacheKey) || deleted
  incrementMetric('deletes', cacheKey)
  return deleted
}

/**
 * Clear cache keys matching a glob pattern (for example `cache:mx-verification:*`).
 */
export async function clear(pattern: string): Promise<number> {
  const normalizedPattern = String(pattern || '*').trim() || '*'
  let deletedCount = 0

  const redis = getRedisClient()
  if (redis) {
    try {
      const discovered: string[] = []
      for await (const entry of redis.scanIterator({ match: normalizedPattern, count: 100 })) {
        if (typeof entry === 'string' && entry.length > 0) {
          discovered.push(entry)
        }
      }

      for (const key of discovered) {
        const deleted = await deleteKey(key)
        if (deleted) deletedCount += 1
      }
    } catch (error) {
      incrementMetric('errors', `cache:clear:${normalizedPattern}`)
      console.warn('[Cache] Redis clear by pattern failed:', {
        pattern: normalizedPattern,
        error: compactError(error),
      })
    }
  }

  const regex = globPatternToRegex(normalizedPattern)
  const memoryKeys = [...getMemoryStore().keys()]
  for (const key of memoryKeys) {
    if (!regex.test(key)) continue
    const deleted = deleteFromMemoryOnly(key)
    if (deleted) deletedCount += 1
  }

  incrementMetric('clears', `cache:clear:${normalizedPattern}`)
  return deletedCount
}

/**
 * Clear all cache keys assigned to a tag.
 */
export async function clearByTag(tag: string): Promise<number> {
  const normalizedTag = normalizeCacheToken(tag)
  if (!normalizedTag) return 0

  let deletedCount = 0
  const redis = getRedisClient()
  if (redis) {
    try {
      const redisKeys = await redis.smembers<string[]>(tagIndexKey(normalizedTag))
      const keys = Array.isArray(redisKeys) ? redisKeys.map((key) => String(key)) : []

      for (const key of keys) {
        const deleted = await deleteKey(key)
        if (deleted) deletedCount += 1
      }

      await redis.del(tagIndexKey(normalizedTag))
    } catch (error) {
      incrementMetric('errors', `cache:tag:${normalizedTag}`)
      console.warn('[Cache] Redis clearByTag failed:', {
        tag: normalizedTag,
        error: compactError(error),
      })
    }
  }

  const memoryTagIndex = getMemoryTagIndex()
  const memoryKeys = memoryTagIndex.get(normalizedTag)
  if (memoryKeys) {
    for (const key of [...memoryKeys]) {
      const deleted = deleteFromMemoryOnly(key)
      if (deleted) deletedCount += 1
    }
    memoryTagIndex.delete(normalizedTag)
  }

  incrementMetric('clears', `cache:tag:${normalizedTag}`)
  return deletedCount
}

/**
 * Get a cached value or compute it and populate cache.
 * Supports optional hot-key background refresh.
 */
export async function getOrSet<T>(options: GetOrSetOptions<T>): Promise<T> {
  const key = String(options.key || '').trim()
  if (!key) {
    return options.fetcher()
  }

  const ttl = normalizeTtlSeconds(options.ttlSeconds)
  const tags = normalizeTags(options.tags)
  const cacheNull = options.cacheNull === true
  const nullTtlSeconds = normalizeTtlSeconds(options.nullTtlSeconds ?? DEFAULT_NULL_TTL_SECONDS)

  const existing = await readWithMetrics<T>(key)
  if (existing.hit) {
    await maybeRefreshHotKey(
      key,
      ttl,
      tags,
      options.fetcher,
      cacheNull,
      nullTtlSeconds,
      options.backgroundRefresh
    )
    return existing.value as T
  }

  const freshValue = await options.fetcher()
  const shouldCache = freshValue !== null && freshValue !== undefined ? true : cacheNull

  if (shouldCache) {
    const appliedTtl =
      freshValue === null || freshValue === undefined ? nullTtlSeconds : ttl
    await set(key, freshValue, appliedTtl, { tags })
  }

  return freshValue
}

/**
 * Snapshot cache metrics (hit/miss, writes, deletes, errors, refreshes).
 */
export function getCacheMetrics() {
  const store = getMetricsStore()
  const namespaces: Record<string, CacheCounters> = {}

  for (const [namespace, counters] of store.namespaces.entries()) {
    namespaces[namespace] = { ...counters }
  }

  return {
    totals: { ...store.totals },
    namespaces,
    updatedAt: new Date(store.updatedAt).toISOString(),
    redisConfigured: Boolean(getRedisClient()),
    fallback: 'memory',
  }
}

/**
 * Reset in-memory cache metrics.
 */
export function resetCacheMetrics() {
  const store = getMetricsStore()
  store.totals = createEmptyCounters()
  store.namespaces = new Map<string, CacheCounters>()
  store.updatedAt = Date.now()
}

export const cache = {
  get,
  set,
  delete: deleteKey,
  clear,
}

export { deleteKey as delete }
