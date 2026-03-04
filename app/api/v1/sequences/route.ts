import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { err, unauthorized, validationError } from "@/lib/api/response";

const StepTypeSchema = z.enum(["email", "wait", "condition", "task"]);

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

const SequenceCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  steps: z.array(SequenceStepInputSchema).min(1).max(100),
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

type EnrollmentSequenceIdRow = {
  sequence_id: string;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data: sequenceData, error: sequenceError } = await supabase
      .from("sequences")
      .select("id, user_id, name, description, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sequenceError) {
      return err(sequenceError.message || "Failed to fetch sequences", 500);
    }

    const sequences = (sequenceData ?? []) as SequenceRow[];
    if (sequences.length === 0) {
      return NextResponse.json({ sequences: [] });
    }

    const sequenceIds = sequences.map((sequence) => sequence.id);

    const [stepsResult, enrollmentsResult] = await Promise.all([
      supabase.from("sequence_steps").select("sequence_id").in("sequence_id", sequenceIds),
      supabase
        .from("sequence_enrollments")
        .select("sequence_id")
        .in("sequence_id", sequenceIds),
    ]);

    if (stepsResult.error) {
      return err(stepsResult.error.message || "Failed to fetch sequence steps", 500);
    }

    if (enrollmentsResult.error) {
      return err(enrollmentsResult.error.message || "Failed to fetch sequence enrollments", 500);
    }

    const stepCounts = new Map<string, number>();
    for (const row of (stepsResult.data ?? []) as EnrollmentSequenceIdRow[]) {
      stepCounts.set(row.sequence_id, (stepCounts.get(row.sequence_id) ?? 0) + 1);
    }

    const enrollmentCounts = new Map<string, number>();
    for (const row of (enrollmentsResult.data ?? []) as EnrollmentSequenceIdRow[]) {
      enrollmentCounts.set(row.sequence_id, (enrollmentCounts.get(row.sequence_id) ?? 0) + 1);
    }

    return NextResponse.json({
      sequences: sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        description: sequence.description ?? "",
        status: sequence.status,
        step_count: stepCounts.get(sequence.id) ?? 0,
        enrollment_count: enrollmentCounts.get(sequence.id) ?? 0,
        created_at: sequence.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to fetch sequences", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = SequenceCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    const { data: sequenceData, error: sequenceError } = await supabase
      .from("sequences")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || "",
        status: parsed.data.status ?? "draft",
      })
      .select("id, user_id, name, description, status, created_at, updated_at")
      .single<SequenceRow>();

    if (sequenceError || !sequenceData) {
      return err(sequenceError?.message || "Failed to create sequence", 500);
    }

    const nowIso = new Date().toISOString();
    const stepsPayload = parsed.data.steps.map((step, index) => ({
      sequence_id: sequenceData.id,
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

    const { data: stepsData, error: stepsError } = await supabase
      .from("sequence_steps")
      .insert(stepsPayload)
      .select(
        "id, sequence_id, step_order, step_name, step_type, subject, body, delay_days, send_on_days, send_from_hour, send_to_hour, condition_type, attachments, created_at"
      )
      .order("step_order", { ascending: true });

    if (stepsError) {
      await supabase.from("sequences").delete().eq("id", sequenceData.id).eq("user_id", user.id);
      return err(stepsError.message || "Failed to create sequence steps", 500);
    }

    return NextResponse.json(
      {
        sequence: sequenceData,
        steps: (stepsData ?? []) as SequenceStepRow[],
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to create sequence", 500);
  }
}
