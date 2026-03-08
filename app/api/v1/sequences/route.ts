import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  CompatibleSequenceStepSchema,
  normalizeIncomingSequenceSteps,
  normalizeStoredSequenceSteps,
  syncSequenceSteps,
  toLegacySequenceStep,
} from "@/lib/sequences/contracts";

const SequenceCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  steps: z.array(CompatibleSequenceStepSchema).min(1).max(100),
});

type SequenceStatus = "draft" | "active" | "paused" | "archived";

type SequenceRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  status: SequenceStatus;
  steps: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type SequenceIdRow = {
  sequence_id: string;
};

function parseError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data: sequenceData, error: sequenceError } = await supabase
      .from("sequences")
      .select("id, user_id, name, description, goal, status, steps, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sequenceError) {
      return NextResponse.json(
        { error: parseError(sequenceError, "Failed to fetch sequences") },
        { status: 500 }
      );
    }

    const sequences = (sequenceData ?? []) as SequenceRow[];
    if (sequences.length === 0) {
      return NextResponse.json({ sequences: [] });
    }

    const sequenceIds = sequences.map((sequence) => sequence.id);
    const [stepResult, enrollmentResult] = await Promise.all([
      supabase.from("sequence_steps").select("sequence_id").in("sequence_id", sequenceIds),
      supabase.from("sequence_enrollments").select("sequence_id").in("sequence_id", sequenceIds),
    ]);

    if (stepResult.error) {
      return NextResponse.json(
        { error: parseError(stepResult.error, "Failed to fetch sequence steps") },
        { status: 500 }
      );
    }

    if (enrollmentResult.error) {
      return NextResponse.json(
        { error: parseError(enrollmentResult.error, "Failed to fetch sequence enrollments") },
        { status: 500 }
      );
    }

    const stepCounts = new Map<string, number>();
    for (const row of (stepResult.data ?? []) as SequenceIdRow[]) {
      stepCounts.set(row.sequence_id, (stepCounts.get(row.sequence_id) ?? 0) + 1);
    }

    const enrollmentCounts = new Map<string, number>();
    for (const row of (enrollmentResult.data ?? []) as SequenceIdRow[]) {
      enrollmentCounts.set(row.sequence_id, (enrollmentCounts.get(row.sequence_id) ?? 0) + 1);
    }

    return NextResponse.json({
      sequences: sequences.map((sequence) => {
        const storedSteps = normalizeStoredSequenceSteps(sequence.steps);
        return {
          id: sequence.id,
          name: sequence.name,
          description: sequence.description ?? "",
          status: sequence.status,
          step_count: stepCounts.get(sequence.id) ?? storedSteps.length,
          enrollment_count: enrollmentCounts.get(sequence.id) ?? 0,
          created_at: sequence.created_at,
        };
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = SequenceCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid sequence payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const normalizedSteps = normalizeIncomingSequenceSteps(parsed.data.steps);
    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status ?? "draft",
        steps: normalizedSteps,
      })
      .select("id, user_id, name, description, goal, status, steps, created_at, updated_at")
      .single<SequenceRow>();

    if (sequenceError || !sequence) {
      return NextResponse.json(
        { error: parseError(sequenceError, "Failed to create sequence") },
        { status: 500 }
      );
    }

    const syncResult = await syncSequenceSteps(supabase, sequence.id, normalizedSteps);
    if (syncResult.error) {
      await supabase.from("sequences").delete().eq("id", sequence.id).eq("user_id", user.id);
      return NextResponse.json(
        { error: parseError(syncResult.error, "Failed to create sequence steps") },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        sequence: {
          id: sequence.id,
          user_id: sequence.user_id,
          name: sequence.name,
          description: sequence.description,
          status: sequence.status,
          created_at: sequence.created_at,
          updated_at: sequence.updated_at,
        },
        steps: normalizedSteps.map((step, index) => toLegacySequenceStep(step, index)),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sequence" },
      { status: 500 }
    );
  }
}
