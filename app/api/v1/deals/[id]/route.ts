import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

const VALID_STAGES = [
  "prospecting", "contacted", "interested",
  "meeting", "proposal", "won", "lost",
] as const

type Params = Promise<{ id: string }>

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const { data, error } = await supabase
      .from("deals")
      .select("*, contacts(id, first_name, last_name, email)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[deals GET id]", err)
    return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = (await request.json()) as {
      stage?: string
      value?: number | null
      probability?: number
      title?: string
      company?: string
      notes?: string | null
      expected_close?: string | null
      lost_reason?: string | null
      contact_id?: string | null
      currency?: string
      tags?: string[]
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("deals")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const patch: Record<string, unknown> = {}
    if (body.stage !== undefined) {
      if (!VALID_STAGES.includes(body.stage as (typeof VALID_STAGES)[number])) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
      }
      patch.stage = body.stage
    }
    if (body.value !== undefined) patch.value = body.value
    if (body.probability !== undefined) patch.probability = body.probability
    if (body.title !== undefined) patch.title = body.title.trim()
    if (body.company !== undefined) patch.company = body.company.trim()
    if (body.notes !== undefined) patch.notes = body.notes
    if (body.expected_close !== undefined) patch.expected_close = body.expected_close
    if (body.lost_reason !== undefined) patch.lost_reason = body.lost_reason
    if (body.contact_id !== undefined) patch.contact_id = body.contact_id
    if (body.currency !== undefined) patch.currency = body.currency
    if (body.tags !== undefined) patch.tags = body.tags

    const { data, error } = await supabase
      .from("deals")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, contacts(id, first_name, last_name, email)")
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[deals PATCH]", err)
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const { error } = await supabase
      .from("deals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[deals DELETE]", err)
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 })
  }
}
