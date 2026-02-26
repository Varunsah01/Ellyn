import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

const VALID_STAGES = [
  "prospecting", "contacted", "interested",
  "meeting", "proposal", "won", "lost",
] as const

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const sp = request.nextUrl.searchParams
    const stage = sp.get("stage")
    const search = sp.get("search") ?? ""

    let query = supabase
      .from("deals")
      .select(
        "id, user_id, contact_id, title, company, value, currency, stage, " +
        "probability, expected_close, lost_reason, notes, tags, created_at, updated_at, " +
        "contacts(id, first_name, last_name, email)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (stage && VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
      query = query.eq("stage", stage)
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[deals GET]", err)
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const body = (await request.json()) as {
      title?: string
      company?: string
      value?: number | null
      currency?: string
      stage?: string
      probability?: number
      expected_close?: string | null
      notes?: string
      tags?: string[]
      contact_id?: string | null
    }

    const title = body.title?.trim()
    const company = body.company?.trim()
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })
    if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 })

    const stage = body.stage ?? "prospecting"
    if (!VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("deals")
      .insert({
        user_id: user.id,
        title,
        company,
        value: body.value ?? null,
        currency: body.currency ?? "USD",
        stage,
        probability: body.probability ?? 50,
        expected_close: body.expected_close ?? null,
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        contact_id: body.contact_id ?? null,
      })
      .select("*, contacts(id, first_name, last_name, email)")
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[deals POST]", err)
    return NextResponse.json({ error: "Failed to create deal" }, { status: 500 })
  }
}
