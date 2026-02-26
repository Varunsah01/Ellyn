import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

// GET /api/v1/tracker
// Returns all contacts that are in a stage (tracker-enrolled) plus stage data
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    // All contacts with a stage (tracked contacts) + outreach info
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, company_name, role, linkedin_url, " +
        "avatar_url, stage_id, applied_at, interview_date, job_url, " +
        "salary_range, excitement_level, notes, tags, created_at, updated_at, " +
        "confidence, status"
      )
      .eq("user_id", user.id)
      .not("stage_id", "is", null)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Fetch last outreach date per contact from outreach table
    type ContactRow = Record<string, unknown> & { id: string }
    const rows = (contacts ?? []) as unknown as ContactRow[]
    const contactIds = rows.map((c) => c.id)
    const lastContactedMap: Record<string, string> = {}

    if (contactIds.length > 0) {
      const { data: outreach } = await supabase
        .from("outreach")
        .select("contact_id, sent_at")
        .eq("user_id", user.id)
        .in("contact_id", contactIds)
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })

      for (const row of (outreach ?? []) as { contact_id: string; sent_at: string }[]) {
        if (!lastContactedMap[row.contact_id]) {
          lastContactedMap[row.contact_id] = row.sent_at
        }
      }
    }

    const enriched = rows.map((c) => ({
      ...c,
      last_contacted_at: lastContactedMap[c.id] ?? null,
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[tracker GET]", err)
    return NextResponse.json({ error: "Failed to fetch tracker data" }, { status: 500 })
  }
}
