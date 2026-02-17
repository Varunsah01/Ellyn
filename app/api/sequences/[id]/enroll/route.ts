import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { buildEnrollmentSteps } from "@/lib/sequence-engine"
import { SequenceEnrollSchema, formatZodError } from "@/lib/validation/schemas"

/**
 * Handle POST requests for `/api/sequences/[id]/enroll`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the POST /api/sequences/[id]/enroll request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/sequences/[id]/enroll
 * fetch('/api/sequences/[id]/enroll', { method: 'POST' })
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
    }

    const sequenceId = params.id
    const parsed = SequenceEnrollSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { contactIds, startDate, overrides } = parsed.data

    const { data: steps, error: stepsError } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true })

    if (stepsError || !steps) {
      return NextResponse.json(
        { error: "Failed to load sequence steps" },
        { status: 500 }
      )
    }

    const { data: existing } = await supabase
      .from("sequence_enrollments")
      .select("contact_id")
      .eq("sequence_id", sequenceId)
      .in("contact_id", contactIds)

    const existingIds = new Set(existing?.map((e) => e.contact_id))
    const newContactIds = contactIds.filter((id) => !existingIds.has(id))

    if (newContactIds.length === 0) {
      return NextResponse.json({ message: "No new contacts to enroll" })
    }

    const startDateObj = startDate ? new Date(startDate) : new Date()
    const now = new Date()

    const enrollmentPayload = newContactIds.map((contactId) => ({
      sequence_id: sequenceId,
      contact_id: contactId,
      status: startDateObj <= now ? "in_progress" : "not_started",
      start_date: startDateObj.toISOString(),
      current_step: 0,
      next_step_at: startDateObj.toISOString(),
    }))

    const { data: enrollments, error: enrollError } = await supabase
      .from("sequence_enrollments")
      .insert(enrollmentPayload)
      .select()

    if (enrollError || !enrollments) {
      return NextResponse.json(
        { error: "Failed to enroll contacts", details: enrollError?.message },
        { status: 500 }
      )
    }

    const stepPayload = enrollments.flatMap((enrollment) =>
      buildEnrollmentSteps({
        steps: steps.map((step) => ({ ...step, order: step.step_order })),
        startDate: startDateObj,
        overrides,
        contactId: enrollment.contact_id,
      }).map((step) => ({
        ...step,
        enrollment_id: enrollment.id,
      }))
    )

    const { error: stepError } = await supabase
      .from("sequence_enrollment_steps")
      .insert(stepPayload)

    if (stepError) {
      return NextResponse.json(
        { error: "Failed to create enrollment steps", details: stepError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
