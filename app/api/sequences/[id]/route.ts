import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getNextStepDate } from "@/lib/sequence-engine"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
    }

    const sequenceId = params.id

    const { data: sequence, error: seqError } = await supabase
      .from("sequences")
      .select("*")
      .eq("id", sequenceId)
      .single()

    if (seqError || !sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 })
    }

    const { data: steps } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true })

    const { data: enrollments } = await supabase
      .from("sequence_enrollments")
      .select("*")
      .eq("sequence_id", sequenceId)

    const enrollmentIds = enrollments?.map((e) => e.id) ?? []
    const contactIds = enrollments?.map((e) => e.contact_id) ?? []

    const [{ data: enrollmentSteps }, { data: events }, { data: contacts }] =
      await Promise.all([
        enrollmentIds.length
          ? supabase
              .from("sequence_enrollment_steps")
              .select("*")
              .in("enrollment_id", enrollmentIds)
          : Promise.resolve({ data: [] }),
        enrollmentIds.length
          ? supabase
              .from("sequence_events")
              .select("*")
              .in("enrollment_id", enrollmentIds)
          : Promise.resolve({ data: [] }),
        contactIds.length
          ? supabase.from("contacts").select("*").in("id", contactIds)
          : Promise.resolve({ data: [] }),
      ])

    const contactMap = new Map(contacts?.map((contact) => [contact.id, contact]))

    const enrollmentStepMap = new Map<string, any[]>()
    enrollmentSteps?.forEach((step) => {
      const list = enrollmentStepMap.get(step.enrollment_id) ?? []
      list.push(step)
      enrollmentStepMap.set(step.enrollment_id, list)
    })

    const enrichedEnrollments =
      enrollments?.map((enrollment) => {
        const stepsForEnrollment = enrollmentStepMap.get(enrollment.id) ?? []
        return {
          ...enrollment,
          contact: contactMap.get(enrollment.contact_id) ?? null,
          next_step_at: enrollment.next_step_at ?? getNextStepDate(stepsForEnrollment),
        }
      }) ?? []

    return NextResponse.json({
      sequence: {
        ...sequence,
        steps: (steps || []).map((step) => ({
          ...step,
          order: step.step_order,
        })),
        createdAt: sequence.created_at,
        updatedAt: sequence.updated_at,
      },
      steps: (steps || []).map((step) => ({
        ...step,
        order: step.step_order,
      })),
      enrollments: enrichedEnrollments,
      enrollmentSteps: enrollmentSteps || [],
      events: events || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
    }

    const body = await request.json()
    const { status, name, description, goal } = body

    const { error } = await supabase
      .from("sequences")
      .update({
        status,
        name,
        description,
        goal,
      })
      .eq("id", params.id)

    if (error) {
      return NextResponse.json(
        { error: "Failed to update sequence", details: error.message },
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
