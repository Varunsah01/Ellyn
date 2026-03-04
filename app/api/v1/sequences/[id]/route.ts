import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { err, unauthorized, notFound, validationError } from "@/lib/api/response";
import { checkApiRateLimit, rateLimitExceeded } from "@/lib/rate-limit";

const StepTypeSchema = z.enum(["email", "wait", "condition", "task"]);
const SequencePatchStatusSchema = z.enum(["draft", "active", "paused", "archived", "completed"]);

const SequenceStepInputSchema = z.object({
  step_order: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
  step_name: z.string().trim().max(200).optional(),
  step_type: StepTypeSchema.optional(),
  stepType: StepTypeSchema.optional(),
  type: StepTypeSchema.optional(),
  subject: z.string().trim().max(500).optional(),
  body: z.string().trim().max(20000).optional(),
  delay_days: z.number().int().min(0).max(3650).optional(),
  delayDays: z.number().int().min(0).max(3650).optional(),
  send_on_days: z.array(z.number().int().min(0).max(6)).optional(),
  send_from_hour: z.number().int().min(0).max(23).optional(),
  send_to_hour: z.number().int().min(0).max(23).optional(),
  condition_type: z.string().trim().max(120).nullable().optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
});

const SequencePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: SequencePatchStatusSchema.optional(),
    steps: z.array(SequenceStepInputSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type SequenceRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "archived";
  created_at: string | null;
  updated_at: string | null;
};

type SequenceStepRow = {
  id: string;
  sequence_id: string;
  step_order: number | null;
  step_name: string | null;
  step_type: "email" | "wait" | "condition" | "task" | null;
  subject: string | null;
  body: string | null;
  delay_days: number | null;
  send_on_days: unknown;
  send_from_hour: number | null;
  send_to_hour: number | null;
  condition_type: string | null;
  attachments: unknown;
  created_at: string | null;
};

type SequenceEnrollmentRow = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: "active" | "paused" | "completed" | "bounced" | null;
  current_step_index: number | null;
  next_step_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

type SequenceEnrollmentRowWithJoin = Omit<SequenceEnrollmentRow, "contact"> & {
  contact:
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    | null;
};

type RouteContext = {
  params: {
    id: string;
  };
};

async function getOwnedSequence(sequenceId: string, userId: string) {
  const supabase = await createServiceRoleClient();
  const result = await supabase
    .from("sequences")
    .select("id, user_id, name, description, status, created_at, updated_at")
    .eq("id", sequenceId)
    .eq("user_id", userId)
    .maybeSingle<SequenceRow>();

  return { supabase, ...result };
}

async function getSequenceSteps(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  sequenceId: string
) {
  return supabase
    .from("sequence_steps")
    .select(
      "id, sequence_id, step_order, step_name, step_type, subject, body, delay_days, send_on_days, send_from_hour, send_to_hour, condition_type, attachments, created_at"
    )
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });
}

function buildStats(enrollments: SequenceEnrollmentRow[]) {
  return {
    active: enrollments.filter((enrollment) => enrollment.status === "active").length,
    completed: enrollments.filter((enrollment) => enrollment.status === "completed").length,
    bounced: enrollments.filter((enrollment) => enrollment.status === "bounced").length,
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const owned = await getOwnedSequence(params.id, user.id);

    if (owned.error) return err(owned.error.message || "Failed to fetch sequence", 500);
    if (!owned.data) return notFound("Sequence");
    const sequenceId = owned.data.id;

    const [stepsResult, enrollmentsResult] = await Promise.all([
      getSequenceSteps(owned.supabase, sequenceId),
      owned.supabase
        .from("sequence_enrollments")
        .select(
          "id, sequence_id, contact_id, status, current_step_index, next_step_at, started_at, completed_at, contact:contacts(id, first_name, last_name, email)"
        )
        .eq("sequence_id", sequenceId)
        .order("started_at", { ascending: false }),
    ]);

    if (stepsResult.error) return err(stepsResult.error.message || "Failed to fetch sequence steps", 500);
    if (enrollmentsResult.error) return err(enrollmentsResult.error.message || "Failed to fetch sequence enrollments", 500);

    const steps = (stepsResult.data ?? []) as SequenceStepRow[];
    const rawEnrollments = (enrollmentsResult.data ?? []) as SequenceEnrollmentRowWithJoin[];
    const enrollments = rawEnrollments.map((enrollment) => ({
      ...enrollment,
      contact: Array.isArray(enrollment.contact) ? enrollment.contact[0] ?? null : enrollment.contact,
    }));

    return NextResponse.json({
      sequence: owned.data,
      steps,
      enrollments,
      stats: buildStats(enrollments),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to fetch sequence", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const rl = await checkApiRateLimit(`sequence-patch:${user.id}`, 20, 300);
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt);

    const owned = await getOwnedSequence(params.id, user.id);

    if (owned.error) return err(owned.error.message || "Failed to fetch sequence", 500);
    if (!owned.data) return notFound("Sequence");
    const sequenceId = owned.data.id;

    const parsed = SequencePatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    let sequence = owned.data;
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;
    if (parsed.data.status !== undefined) {
      updatePayload.status = parsed.data.status === "completed" ? "archived" : parsed.data.status;
    }

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();

      const { data: updatedSequence, error: updateError } = await owned.supabase
        .from("sequences")
        .update(updatePayload)
        .eq("id", sequenceId)
        .eq("user_id", user.id)
        .select("id, user_id, name, description, status, created_at, updated_at")
        .single<SequenceRow>();

      if (updateError || !updatedSequence) {
        return err(updateError?.message || "Failed to update sequence", 500);
      }

      sequence = updatedSequence;
    }

    if (parsed.data.steps !== undefined) {
      const { error: deleteError } = await owned.supabase
        .from("sequence_steps")
        .delete()
        .eq("sequence_id", sequenceId);

      if (deleteError) {
        return err(deleteError.message || "Failed to replace sequence steps", 500);
      }

      const nowIso = new Date().toISOString();
      const stepPayload = parsed.data.steps.map((step, index) => ({
        sequence_id: sequenceId,
        step_order: step.step_order ?? step.order ?? index,
        step_name: step.step_name ?? `Step ${index + 1}`,
        step_type: step.step_type ?? step.stepType ?? step.type ?? "email",
        subject: step.subject ?? "",
        body: step.body ?? "",
        delay_days: step.delay_days ?? step.delayDays ?? 1,
        send_on_days: step.send_on_days ?? [1, 2, 3, 4, 5],
        send_from_hour: step.send_from_hour ?? 9,
        send_to_hour: step.send_to_hour ?? 17,
        condition_type: step.condition_type ?? null,
        attachments: step.attachments ?? [],
        created_at: nowIso,
      }));

      const { error: insertError } = await owned.supabase.from("sequence_steps").insert(stepPayload);
      if (insertError) {
        return err(insertError.message || "Failed to insert sequence steps", 500);
      }
    }

    const { data: stepsData, error: stepsError } = await getSequenceSteps(owned.supabase, sequenceId);
    if (stepsError) {
      return err(stepsError.message || "Failed to fetch sequence steps", 500);
    }

    return NextResponse.json({
      sequence,
      steps: (stepsData ?? []) as SequenceStepRow[],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to update sequence", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const owned = await getOwnedSequence(params.id, user.id);

    if (owned.error) return err(owned.error.message || "Failed to fetch sequence", 500);
    if (!owned.data) return notFound("Sequence");

    const { error } = await owned.supabase.from("sequences").delete().eq("id", owned.data.id).eq("user_id", user.id);
    if (error) return err(error.message || "Failed to delete sequence", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to delete sequence", 500);
  }
}
