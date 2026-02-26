import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

const DEFAULT_STAGES = [
  { name: "Researching", color: "#6366F1", position: 0 },
  { name: "Contacted",   color: "#8B5CF6", position: 1 },
  { name: "Replied",     color: "#06B6D4", position: 2 },
  { name: "Interviewing",color: "#F59E0B", position: 3 },
  { name: "Offer",       color: "#10B981", position: 4 },
  { name: "Closed",      color: "#6B7280", position: 5 },
]

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    let { data: stages, error } = await supabase
      .from("application_stages")
      .select("*")
      .eq("user_id", user.id)
      .order("position", { ascending: true })

    if (error) throw error

    // Seed defaults on first access
    if (!stages || stages.length === 0) {
      const rows = DEFAULT_STAGES.map((s) => ({
        ...s,
        user_id: user.id,
        is_default: true,
      }))

      const { data: seeded, error: seedErr } = await supabase
        .from("application_stages")
        .insert(rows)
        .select()

      if (seedErr) throw seedErr
      stages = seeded ?? []
    }

    // Attach contact counts
    const stageIds = (stages ?? []).map((s: { id: string }) => s.id)
    let countMap: Record<string, number> = {}

    if (stageIds.length > 0) {
      const { data: counts } = await supabase
        .from("contacts")
        .select("stage_id")
        .eq("user_id", user.id)
        .in("stage_id", stageIds)

      for (const row of counts ?? []) {
        const id = (row as { stage_id: string }).stage_id
        countMap[id] = (countMap[id] ?? 0) + 1
      }
    }

    const result = (stages ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      contact_count: countMap[s.id as string] ?? 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[stages GET]", err)
    return NextResponse.json({ error: "Failed to fetch stages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const body = (await request.json()) as { name?: string; color?: string }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    // Determine next position
    const { data: last } = await supabase
      .from("application_stages")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1)
      .single()

    const position = last ? (last as { position: number }).position + 1 : 0

    const { data: stage, error } = await supabase
      .from("application_stages")
      .insert({
        user_id: user.id,
        name,
        color: body.color ?? "#6366F1",
        position,
        is_default: false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ...(stage as Record<string, unknown>), contact_count: 0 }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[stages POST]", err)
    return NextResponse.json({ error: "Failed to create stage" }, { status: 500 })
  }
}
