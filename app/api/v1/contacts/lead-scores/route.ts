import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { computeLeadScore, type TrackingEvent, type LeadScore } from "@/lib/lead-scoring"

// GET /api/v1/contacts/lead-scores?ids=id1,id2,...
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()

    const idsParam = request.nextUrl.searchParams.get("ids")
    if (!idsParam) {
      return NextResponse.json({})
    }
    const ids = idsParam.split(",").filter(Boolean).slice(0, 200)

    // Fetch contacts (to get email_verified, email_confidence, linkedin_url)
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, email_verified, email_confidence, linkedin_url")
      .eq("user_id", user.id)
      .in("id", ids)

    if (contactsError) throw contactsError

    // Fetch tracking events from activity_log — type like email_*
    const { data: events, error: eventsError } = await supabase
      .from("activity_log")
      .select("contact_id, type, created_at")
      .eq("user_id", user.id)
      .in("contact_id", ids)
      .in("type", ["email_opened", "email_clicked", "email_replied", "opened", "clicked", "replied"])

    if (eventsError) {
      // Non-fatal: if table doesn't exist yet, return zero scores
      console.warn("[lead-scores] activity_log query failed:", eventsError.message)
    }

    // Group events by contact_id
    const eventsByContact = new Map<string, TrackingEvent[]>()
    for (const e of events ?? []) {
      if (!e.contact_id) continue
      const list = eventsByContact.get(e.contact_id) ?? []
      // Normalize type: email_opened → opened, etc.
      const normalized = (e.type as string)
        .replace("email_", "")
        .replace("_", "") as TrackingEvent["event_type"]
      list.push({ event_type: normalized, occurred_at: e.created_at as string })
      eventsByContact.set(e.contact_id, list)
    }

    // Compute scores
    const scores: Record<string, LeadScore> = {}
    for (const c of contacts ?? []) {
      scores[c.id] = computeLeadScore(
        {
          email_verified: c.email_verified,
          email_confidence: c.email_confidence,
          linkedin_url: c.linkedin_url,
        },
        eventsByContact.get(c.id) ?? []
      )
    }

    return NextResponse.json(scores)
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[lead-scores GET]", err)
    return NextResponse.json({ error: "Failed to fetch lead scores" }, { status: 500 })
  }
}
