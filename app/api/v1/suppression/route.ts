import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

// GET /api/v1/suppression — list suppressed emails
export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const { data, error } = await supabase
      .from("suppression_list")
      .select("*")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[suppression GET]", err)
    return NextResponse.json({ error: "Failed to fetch suppression list" }, { status: 500 })
  }
}

// POST /api/v1/suppression — add email(s) to suppression list
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const body = (await request.json()) as {
      email?: string
      emails?: string[]
      reason?: string
    }

    const reason = body.reason ?? "manual"
    if (!["unsubscribed", "bounced", "manual"].includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
    }

    // Support both single email and bulk paste (emails array)
    const rawEmails = body.emails
      ? body.emails
      : body.email
      ? [body.email]
      : []

    const emails = rawEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"))

    if (emails.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    const rows = emails.map((email) => ({
      user_id: user.id,
      email,
      reason,
    }))

    const { data, error } = await supabase
      .from("suppression_list")
      .upsert(rows, { onConflict: "user_id,email", ignoreDuplicates: true })
      .select()

    if (error) throw error

    return NextResponse.json({ added: data?.length ?? 0 }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[suppression POST]", err)
    return NextResponse.json({ error: "Failed to add to suppression list" }, { status: 500 })
  }
}
