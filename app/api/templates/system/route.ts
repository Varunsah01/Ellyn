import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { captureApiException } from "@/lib/monitoring/sentry"

// GET /api/templates/system — Return all system templates (is_system = true)
// Uses service role to bypass RLS since system templates have user_id = null
export async function GET() {
  try {
    await getAuthenticatedUser()

    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_system", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching system templates:", error)
      return NextResponse.json(
        { error: "Failed to fetch system templates", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, templates: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error in GET /api/templates/system:", err)
    captureApiException(err, { route: "/api/templates/system", method: "GET" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
