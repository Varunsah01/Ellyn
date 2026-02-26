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

    const body = (await request.json()) as { stageId: string | null }

    // Verify contact ownership
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    // If stageId provided, verify it belongs to this user
    if (body.stageId !== null && body.stageId !== undefined) {
      const { data: stage } = await supabase
        .from("application_stages")
        .select("id")
        .eq("id", body.stageId)
        .eq("user_id", user.id)
        .single()

      if (!stage) {
        return NextResponse.json({ error: "Stage not found" }, { status: 404 })
      }
    }

    const { data: updated, error } = await supabase
      .from("contacts")
      .update({ stage_id: body.stageId ?? null })
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
    console.error("[contact stage PATCH]", err)
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 })
  }
}
