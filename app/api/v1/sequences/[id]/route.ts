import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  CompatibleSequenceStepSchema,
  getPrimaryContactEmail,
  normalizeIncomingSequenceSteps,
  normalizeSequenceStepRows,
  normalizeStoredSequenceSteps,
  syncSequenceSteps,
  toLegacySequenceStep,
} from "@/lib/sequences/contracts";

const SequencePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(["draft", "active", "paused", "archived", "completed"]).optional(),
    steps: z.array(CompatibleSequenceStepSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type SequenceStatus = "draft" | "active" | "paused" | "archived";
type EnrollmentStatus = "active" | "paused" | "completed" | "bounced";

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

type SequenceStepRow = {
  id: string | null;
  step_order: number | null;
  delay_days: number | null;
  template_id: string | null;
  subject: string | null;
  body: string | null;
  stop_on_reply: boolean | null;
  stop_on_bounce: boolean | null;
  attachments: unknown;
};

type SequenceContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
  confirmed_email: string | null;
  inferred_email: string | null;
};

type SequenceEnrollmentRow = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: EnrollmentStatus | null;
  current_step_index: number | null;
  next_step_at: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  contact:
    | SequenceContactRow
    | SequenceContactRow[]
    | null;
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

async function getOwnedSequence(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  sequenceId: string,
  userId: string
) {
  return supabase
    .from("sequences")
    .select("id, user_id, name, description, goal, status, steps, created_at, updated_at")
    .eq("id", sequenceId)
    .eq("user_id", userId)
    .maybeSingle<SequenceRow>();
}

async function loadStoredSteps(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  sequence: SequenceRow
) {
  const inlineSteps = normalizeStoredSequenceSteps(sequence.steps);
  if (inlineSteps.length > 0) {
    return inlineSteps;
  }

  const { data, error } = await supabase
    .from("sequence_steps")
    .select(
      "id, step_order, delay_days, template_id, subject, body, stop_on_reply, stop_on_bounce, attachments"
    )
    .eq("sequence_id", sequence.id)
    .order("step_order", { ascending: true });

  if (error) {
    throw new Error(parseError(error, "Failed to fetch sequence steps"));
  }

  return normalizeSequenceStepRows((data ?? []) as SequenceStepRow[]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();
    const owned = await getOwnedSequence(supabase, params.id, user.id);

    if (owned.error) {
      return NextResponse.json(
        { error: parseError(owned.error, "Failed to fetch sequence") },
        { status: 500 }
      );
    }

    if (!owned.data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const storedSteps = await loadStoredSteps(supabase, owned.data);
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("sequence_enrollments")
      .select(
        "id, sequence_id, contact_id, status, current_step_index, next_step_at, enrolled_at, completed_at, contact:contacts(id, first_name, last_name, company, role, confirmed_email, inferred_email)"
      )
      .eq("sequence_id", owned.data.id)
      .order("enrolled_at", { ascending: false });

    if (enrollmentError) {
      return NextResponse.json(
        { error: parseError(enrollmentError, "Failed to fetch sequence enrollments") },
        { status: 500 }
      );
    }

    const enrollments = ((enrollmentData ?? []) as SequenceEnrollmentRow[]).map((enrollment) => {
      const contact = Array.isArray(enrollment.contact)
        ? enrollment.contact[0] ?? null
        : enrollment.contact;

      return {
        id: enrollment.id,
        contact_id: enrollment.contact_id,
        status: enrollment.status ?? "active",
        current_step_index: enrollment.current_step_index ?? 0,
        started_at: enrollment.enrolled_at,
        completed_at: enrollment.completed_at,
        contact: contact
          ? {
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: getPrimaryContactEmail(contact),
              company_name: contact.company,
              role: contact.role,
            }
          : null,
      };
    });

    return NextResponse.json({
      sequence: {
        id: owned.data.id,
        user_id: owned.data.user_id,
        name: owned.data.name,
        description: owned.data.description,
        status: owned.data.status,
        created_at: owned.data.created_at,
        updated_at: owned.data.updated_at,
      },
      steps: storedSteps.map((step, index) => toLegacySequenceStep(step, index)),
      enrollments,
      stats: {
        active: enrollments.filter((enrollment) => enrollment.status === "active").length,
        completed: enrollments.filter((enrollment) => enrollment.status === "completed").length,
        bounced: enrollments.filter((enrollment) => enrollment.status === "bounced").length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();
    const owned = await getOwnedSequence(supabase, params.id, user.id);

    if (owned.error) {
      return NextResponse.json(
        { error: parseError(owned.error, "Failed to fetch sequence") },
        { status: 500 }
      );
    }

    if (!owned.data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const parsed = SequencePatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid sequence payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    let storedSteps = await loadStoredSteps(supabase, owned.data);
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;
    if (parsed.data.status !== undefined) {
      updatePayload.status = parsed.data.status === "completed" ? "archived" : parsed.data.status;
    }
    if (parsed.data.steps !== undefined) {
      storedSteps = normalizeIncomingSequenceSteps(parsed.data.steps);
      updatePayload.steps = storedSteps;
    }

    const { data: updatedSequence, error: updateError } = await supabase
      .from("sequences")
      .update(updatePayload)
      .eq("id", owned.data.id)
      .eq("user_id", user.id)
      .select("id, user_id, name, description, goal, status, steps, created_at, updated_at")
      .single<SequenceRow>();

    if (updateError || !updatedSequence) {
      return NextResponse.json(
        { error: parseError(updateError, "Failed to update sequence") },
        { status: 500 }
      );
    }

    if (parsed.data.steps !== undefined) {
      const syncResult = await syncSequenceSteps(supabase, updatedSequence.id, storedSteps);
      if (syncResult.error) {
        return NextResponse.json(
          { error: parseError(syncResult.error, "Failed to update sequence steps") },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      sequence: {
        id: updatedSequence.id,
        user_id: updatedSequence.user_id,
        name: updatedSequence.name,
        description: updatedSequence.description,
        status: updatedSequence.status,
        created_at: updatedSequence.created_at,
        updated_at: updatedSequence.updated_at,
      },
      steps: storedSteps.map((step, index) => toLegacySequenceStep(step, index)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sequence" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();
    const owned = await getOwnedSequence(supabase, params.id, user.id);

    if (owned.error) {
      return NextResponse.json(
        { error: parseError(owned.error, "Failed to fetch sequence") },
        { status: 500 }
      );
    }

    if (!owned.data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("sequences")
      .delete()
      .eq("id", owned.data.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: parseError(error, "Failed to delete sequence") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sequence" },
      { status: 500 }
    );
  }
}
