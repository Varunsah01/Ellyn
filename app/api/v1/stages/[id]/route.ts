import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = (await request.json()) as {
      name?: string
      color?: string
      position?: number
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("application_stages")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.color !== undefined) updates.color = body.color
    if (body.position !== undefined) updates.position = body.position

    const { data: updated, error } = await supabase
      .from("application_stages")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[stages PATCH]", err)
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    // Verify ownership
    const { data: existing } = await supabase
      .from("application_stages")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 })
    }

    // Null-out stage_id on all contacts in this stage first
    await supabase
      .from("contacts")
      .update({ stage_id: null })
      .eq("stage_id", id)
      .eq("user_id", user.id)

    const { error } = await supabase
      .from("application_stages")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[stages DELETE]", err)
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 })
  }
}
