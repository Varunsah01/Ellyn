import { NextRequest, NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { computeSequenceStats } from "@/lib/sequence-engine"
import { SequenceCreateSchema, formatZodError } from "@/lib/validation/schemas"


/**
 * Handle GET requests for `/api/sequences`.
 * @returns {unknown} JSON response for the GET /api/sequences request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/sequences
 * fetch('/api/sequences')
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const search = request.nextUrl.searchParams.get("search") ?? ""

    const [{ data: sequences, error: seqError }, { data: steps }, { data: enrollments }, { data: events }] =
      await Promise.all([
        supabase.from("sequences").select("*").order("created_at", { ascending: false }),
        supabase.from("sequence_steps").select("*"),
        supabase.from("sequence_enrollments").select("*"),
        supabase.from("sequence_events").select("*"),
      ])

    if (seqError) {
      return NextResponse.json(
        { error: "Failed to fetch sequences", details: seqError.message },
        { status: 500 }
      )
    }

    const stepsBySequence = new Map<string, any[]>()
    steps?.forEach((step) => {
      const list = stepsBySequence.get(step.sequence_id) ?? []
      list.push({
        ...step,
        order: step.step_order,
      })
      stepsBySequence.set(step.sequence_id, list)
    })

    const enrollmentsBySequence = new Map<string, any[]>()
    enrollments?.forEach((enrollment) => {
      const list = enrollmentsBySequence.get(enrollment.sequence_id) ?? []
      list.push(enrollment)
      enrollmentsBySequence.set(enrollment.sequence_id, list)
    })

    const eventsBySequence = new Map<string, any[]>()
    events?.forEach((event) => {
      const enrollment = enrollments?.find((e) => e.id === event.enrollment_id)
      if (!enrollment) return
      const list = eventsBySequence.get(enrollment.sequence_id) ?? []
      list.push(event)
      eventsBySequence.set(enrollment.sequence_id, list)
    })

    const enriched = (sequences || []).map((sequence) => {
      const sequenceSteps = (stepsBySequence.get(sequence.id) ?? []).sort(
        (a, b) => a.order - b.order
      )
      const sequenceEnrollments = enrollmentsBySequence.get(sequence.id) ?? []
      const sequenceEvents = eventsBySequence.get(sequence.id) ?? []

      const stats = computeSequenceStats({
        enrollments: sequenceEnrollments,
        events: sequenceEvents,
      })

      return {
        ...sequence,
        steps: sequenceSteps,
        contacts: sequenceEnrollments.map((e) => e.contact_id),
        stats,
        createdAt: sequence.created_at,
        updatedAt: sequence.updated_at,
      }
    })

    const filtered = search
      ? (() => {
          const q = search.toLowerCase()
          return enriched.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.description && (s.description as string).toLowerCase().includes(q))
          )
        })()
      : enriched

    return NextResponse.json({ sequences: filtered })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

/**
 * Handle POST requests for `/api/sequences`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/sequences request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/sequences
 * fetch('/api/sequences', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 }
      )
    }

    const parsed = SequenceCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { name, description, goal, status = "draft", steps } = parsed.data

    const { data: sequence, error: seqError } = await supabase
      .from("sequences")
      .insert({
        name,
        description,
        goal,
        status,
      })
      .select()
      .single()

    if (seqError || !sequence) {
      return NextResponse.json(
        { error: "Failed to create sequence", details: seqError?.message },
        { status: 500 }
      )
    }

    const stepPayload = steps.map((step, index: number) => ({
      sequence_id: sequence.id,
      step_order: step.order ?? index + 1,
      delay_days: step.delay_days ?? 0,
      template_id: step.template_id ?? null,
      subject: step.subject,
      body: step.body,
      stop_on_reply: step.stop_on_reply ?? true,
      stop_on_bounce: step.stop_on_bounce ?? true,
      status: step.status ?? "active",
    }))

    const { error: stepError } = await supabase
      .from("sequence_steps")
      .insert(stepPayload)

    if (stepError) {
      return NextResponse.json(
        { error: "Failed to create sequence steps", details: stepError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ sequence }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
