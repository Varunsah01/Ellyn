import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers"
import { get as getCache, set as setCache } from "@/lib/cache/redis"
import { createServiceRoleClient } from "@/lib/supabase/server"

type TagCount = {
  tag: string
  count: number
}

const TAGS_CACHE_TTL_SECONDS = 5 * 60

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const cacheKey = `contact-tags:${user.id}`

    const cached = await getCache<{ tags: TagCount[] }>(cacheKey)
    if (cached && Array.isArray(cached.tags)) {
      return NextResponse.json(cached)
    }

    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from("contacts")
      .select("tags")
      .eq("user_id", user.id)

    if (error) throw error

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      const tags = normalizeTags(row.tags)
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }

    const tags = [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 50)

    const payload = { tags }
    await setCache(cacheKey, payload, TAGS_CACHE_TTL_SECONDS)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.error("[contacts/tags GET]", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}
