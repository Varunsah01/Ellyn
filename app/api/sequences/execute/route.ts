import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getNextStepDate } from "@/lib/sequence-engine"

const TERMINAL_STATUSES = ["paused", "replied", "bounced", "completed"]

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ items: [] })
    }

    const now = new Date().toISOString()

    const { data: dueSteps } = await supabase
      .from("sequence_enrollment_steps")
      .select("*")
      .lte("scheduled_for", now)
      .eq("status", "pending")

    if (!dueSteps || dueSteps.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const enrollmentIds = dueSteps.map((step) => step.enrollment_id)

    const { data: enrollments } = await supabase
      .from("sequence_enrollments")
      .select("*")
      .in("id", enrollmentIds)

    const activeEnrollments =
      enrollments?.filter((enrollment) => !TERMINAL_STATUSES.includes(enrollment.status)) || []

    const activeEnrollmentIds = new Set(activeEnrollments.map((enrollment) => enrollment.id))
    const filteredSteps = dueSteps.filter((step) => activeEnrollmentIds.has(step.enrollment_id))

    const stepIds = filteredSteps.map((step) => step.step_id)
    const contactIds = activeEnrollments.map((enrollment) => enrollment.contact_id)
    const sequenceIds = activeEnrollments.map((enrollment) => enrollment.sequence_id)

    const [{ data: steps }, { data: contacts }, { data: sequences }] = await Promise.all([
      supabase.from("sequence_steps").select("*").in("id", stepIds),
      supabase.from("contacts").select("*").in("id", contactIds),
      supabase.from("sequences").select("*").in("id", sequenceIds),
    ])

    const stepMap = new Map(steps?.map((step) => [step.id, step]))
    const contactMap = new Map(contacts?.map((contact) => [contact.id, contact]))
    const sequenceMap = new Map(sequences?.map((sequence) => [sequence.id, sequence]))
    const enrollmentMap = new Map(activeEnrollments.map((enrollment) => [enrollment.id, enrollment]))

    const items = filteredSteps.map((entry) => {
      const step = stepMap.get(entry.step_id)
      const enrollment = enrollmentMap.get(entry.enrollment_id)
      const contact = enrollment ? contactMap.get(enrollment.contact_id) : null
      const sequence = enrollment ? sequenceMap.get(enrollment.sequence_id) : null

      return {
        enrollmentStepId: entry.id,
        sequenceId: sequence?.id ?? "",
        sequenceName: sequence?.name ?? "Sequence",
        contactName: contact?.full_name ?? "Unknown",
        contactEmail: contact?.confirmed_email || contact?.inferred_email || "",
        subject: entry.subject_override || step?.subject || "",
        body: entry.body_override || step?.body || "",
        scheduledFor: entry.scheduled_for,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json(
      { items: [], error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
    }

    const body = await request.json()
    const { action, enrollmentStepId, enrollmentId } = body

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    if (["mark_sent", "skip_step"].includes(action) && !enrollmentStepId) {
      return NextResponse.json({ error: "enrollmentStepId is required" }, { status: 400 })
    }

    const stepId = enrollmentStepId

    if (action === "mark_sent" || action === "skip_step") {
      const status = action === "mark_sent" ? "sent" : "skipped"
      await supabase
        .from("sequence_enrollment_steps")
        .update({
          status,
          sent_at: action === "mark_sent" ? new Date().toISOString() : null,
        })
        .eq("id", stepId)

      const { data: stepRow } = await supabase
        .from("sequence_enrollment_steps")
        .select("*")
        .eq("id", stepId)
        .single()

      const enrollmentIdToUpdate = stepRow?.enrollment_id

      if (enrollmentIdToUpdate) {
        await supabase.from("sequence_events").insert({
          enrollment_id: enrollmentIdToUpdate,
          step_id: stepRow.step_id,
          event_type: status === "sent" ? "sent" : "skipped",
        })

        const { data: allSteps } = await supabase
          .from("sequence_enrollment_steps")
          .select("*")
          .eq("enrollment_id", enrollmentIdToUpdate)

        const pendingSteps = allSteps?.filter((step) => step.status === "pending") ?? []
        const nextStepAt = getNextStepDate(allSteps ?? [])

        await supabase
          .from("sequence_enrollments")
          .update({
            current_step: stepRow.step_order,
            next_step_at: nextStepAt,
            status: pendingSteps.length === 0 ? "completed" : "in_progress",
          })
          .eq("id", enrollmentIdToUpdate)
      }
    }

    if (["mark_replied", "mark_bounced"].includes(action)) {
      const status = action === "mark_replied" ? "replied" : "bounced"
      if (!enrollmentId) {
        return NextResponse.json({ error: "enrollmentId is required" }, { status: 400 })
      }

      await supabase
        .from("sequence_enrollments")
        .update({ status })
        .eq("id", enrollmentId)

      await supabase
        .from("sequence_enrollment_steps")
        .update({ status: "skipped" })
        .eq("enrollment_id", enrollmentId)
        .eq("status", "pending")

      await supabase.from("sequence_events").insert({
        enrollment_id: enrollmentId,
        event_type: status,
      })
    }

    if (action === "pause_enrollment" && enrollmentId) {
      await supabase.from("sequence_enrollments").update({ status: "paused" }).eq("id", enrollmentId)
      await supabase.from("sequence_events").insert({
        enrollment_id: enrollmentId,
        event_type: "paused",
      })
    }

    if (action === "resume_enrollment" && enrollmentId) {
      await supabase
        .from("sequence_enrollments")
        .update({ status: "in_progress" })
        .eq("id", enrollmentId)
      await supabase.from("sequence_events").insert({
        enrollment_id: enrollmentId,
        event_type: "resumed",
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
