import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/helpers"
import { createServiceRoleClient } from "@/lib/supabase/server"

type Params = Promise<{ email: string }>

// DELETE /api/v1/suppression/:email — remove email from suppression list
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { email } = await params

    const decodedEmail = decodeURIComponent(email).toLowerCase().trim()

    const { error } = await supabase
      .from("suppression_list")
      .delete()
      .eq("user_id", user.id)
      .eq("email", decodedEmail)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[suppression DELETE]", err)
    return NextResponse.json({ error: "Failed to remove from suppression list" }, { status: 500 })
  }
}
