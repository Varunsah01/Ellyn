import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ExecuteActionSchema = z.object({
  action: z.enum(["send", "skip", "pause"]),
  enrollmentId: z.string().uuid(),
  enrollmentStepId: z.string().uuid().optional(),
});

type SequenceEnrollmentRow = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: "active" | "paused" | "completed" | "bounced" | null;
  current_step_index: number | null;
  next_step_at: string | null;
  completed_at: string | null;
};

type SequenceRow = {
  id: string;
  user_id: string;
};

type SequenceStepRow = {
  id: string;
  sequence_id: string;
  step_order: number | null;
  delay_days: number | null;
};

type SequenceEnrollmentStepRow = {
  id: string;
  enrollment_id: string;
  step_id: string;
  status: "pending" | "sent" | "skipped" | "bounced" | null;
};

function addDaysIso(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + Math.max(0, days));
  return next.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = ExecuteActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid execution payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { action, enrollmentId, enrollmentStepId } = parsed.data;

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("sequence_enrollments")
      .select("id, sequence_id, contact_id, status, current_step_index, next_step_at, completed_at")
      .eq("id", enrollmentId)
      .maybeSingle<SequenceEnrollmentRow>();

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message || "Failed to fetch enrollment" }, { status: 500 });
    }

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("id, user_id")
      .eq("id", enrollment.sequence_id)
      .eq("user_id", user.id)
      .maybeSingle<SequenceRow>();

    if (sequenceError) {
      return NextResponse.json({ error: sequenceError.message || "Failed to fetch sequence" }, { status: 500 });
    }

    if (!sequence) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    if (action === "pause") {
      const { error: pauseError } = await supabase
        .from("sequence_enrollments")
        .update({ status: "paused" })
        .eq("id", enrollment.id);

      if (pauseError) {
        return NextResponse.json({ error: pauseError.message || "Failed to pause enrollment" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const { data: sequenceSteps, error: stepsError } = await supabase
      .from("sequence_steps")
      .select("id, sequence_id, step_order, delay_days")
      .eq("sequence_id", sequence.id)
      .order("step_order", { ascending: true });

    if (stepsError) {
      return NextResponse.json({ error: stepsError.message || "Failed to fetch sequence steps" }, { status: 500 });
    }

    const orderedSteps = (sequenceSteps ?? []) as SequenceStepRow[];
    if (orderedSteps.length === 0) {
      return NextResponse.json({ error: "Sequence has no steps" }, { status: 400 });
    }

    const currentStepIndex = Math.max(0, enrollment.current_step_index ?? 0);
    const currentSequenceStep = orderedSteps[currentStepIndex];
    if (!currentSequenceStep) {
      return NextResponse.json({ error: "Enrollment has no executable step" }, { status: 400 });
    }

    let enrollmentStep: SequenceEnrollmentStepRow | null = null;

    if (enrollmentStepId) {
      const stepResult = await supabase
        .from("sequence_enrollment_steps")
        .select("id, enrollment_id, step_id, status")
        .eq("id", enrollmentStepId)
        .eq("enrollment_id", enrollment.id)
        .maybeSingle<SequenceEnrollmentStepRow>();

      if (stepResult.error) {
        return NextResponse.json({ error: stepResult.error.message || "Failed to fetch enrollment step" }, { status: 500 });
      }

      enrollmentStep = stepResult.data;
    } else {
      const stepResult = await supabase
        .from("sequence_enrollment_steps")
        .select("id, enrollment_id, step_id, status")
        .eq("enrollment_id", enrollment.id)
        .eq("step_id", currentSequenceStep.id)
        .maybeSingle<SequenceEnrollmentStepRow>();

      if (stepResult.error) {
        return NextResponse.json({ error: stepResult.error.message || "Failed to fetch enrollment step" }, { status: 500 });
      }

      enrollmentStep = stepResult.data;
    }

    if (!enrollmentStep) {
      return NextResponse.json({ error: "Enrollment step not found" }, { status: 404 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (action === "send") {
      const { error: updateStepError } = await supabase
        .from("sequence_enrollment_steps")
        .update({
          status: "sent",
          sent_at: nowIso,
        })
        .eq("id", enrollmentStep.id)
        .eq("enrollment_id", enrollment.id);

      if (updateStepError) {
        return NextResponse.json({ error: updateStepError.message || "Failed to mark step as sent" }, { status: 500 });
      }

      // Log to email_tracking_events so analytics can count it
      void supabase
        .from("email_tracking_events")
        .insert({
          user_id: user.id,
          contact_id: enrollment.contact_id,
          sequence_id: enrollment.sequence_id,
          event_type: "sent",
          metadata: {
            enrollment_id: enrollment.id,
            enrollment_step_id: enrollmentStep.id,
            step_id: currentSequenceStep.id,
            source: "v1_execute",
          },
        })
        .then(({ error: trackErr }) => {
          if (trackErr) console.error("[v1/sequences/execute] Failed to log sent event:", trackErr);
        });
    }

    if (action === "skip") {
      const { error: updateStepError } = await supabase
        .from("sequence_enrollment_steps")
        .update({
          status: "skipped",
          skipped_at: nowIso,
        })
        .eq("id", enrollmentStep.id)
        .eq("enrollment_id", enrollment.id);

      if (updateStepError) {
        return NextResponse.json({ error: updateStepError.message || "Failed to mark step as skipped" }, { status: 500 });
      }
    }

    const nextStepIndex = currentStepIndex + 1;
    const nextStep = orderedSteps[nextStepIndex] ?? null;

    if (!nextStep) {
      const { error: completeError } = await supabase
        .from("sequence_enrollments")
        .update({
          status: "completed",
          current_step_index: nextStepIndex,
          next_step_at: null,
          completed_at: nowIso,
        })
        .eq("id", enrollment.id);

      if (completeError) {
        return NextResponse.json({ error: completeError.message || "Failed to complete enrollment" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const nextStepAt = addDaysIso(now, nextStep.delay_days ?? 0);
    const { error: advanceError } = await supabase
      .from("sequence_enrollments")
      .update({
        status: "active",
        current_step_index: nextStepIndex,
        next_step_at: nextStepAt,
        completed_at: null,
      })
      .eq("id", enrollment.id);

    if (advanceError) {
      return NextResponse.json({ error: advanceError.message || "Failed to advance enrollment" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      nextStepAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute sequence action" },
      { status: 500 }
    );
  }
}

