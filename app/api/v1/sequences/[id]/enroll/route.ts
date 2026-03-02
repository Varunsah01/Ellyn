import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EnrollmentBodySchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(1000),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
});

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

type ContactRow = {
  id: string;
};

type SequenceEnrollmentInsertRow = {
  sequence_id: string;
  contact_id: string;
  status: "active";
  current_step_index: number;
  next_step_at: string;
  started_at: string;
};

type InsertedEnrollmentRow = {
  id: string;
  contact_id: string;
};

type RouteContext = {
  params: {
    id: string;
  };
};

function toIsoDate(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = EnrollmentBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid enrollment payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const startIso = toIsoDate(parsed.data.startDate);
    if (!startIso) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const { data: sequence, error: sequenceError } = await supabase
      .from("sequences")
      .select("id, user_id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle<SequenceRow>();

    if (sequenceError) {
      return NextResponse.json({ error: sequenceError.message || "Failed to fetch sequence" }, { status: 500 });
    }

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
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

    const dedupedContactIds = Array.from(new Set(parsed.data.contactIds));

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", user.id)
      .in("id", dedupedContactIds);

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message || "Failed to fetch contacts" }, { status: 500 });
    }

    const validContactIds = new Set(((contacts ?? []) as ContactRow[]).map((contact) => contact.id));
    const ownedContactIds = dedupedContactIds.filter((id) => validContactIds.has(id));

    if (ownedContactIds.length === 0) {
      return NextResponse.json({
        enrolled: 0,
        skipped: dedupedContactIds.length,
      });
    }

    const firstStepDelayDays = Math.max(0, orderedSteps[0]?.delay_days ?? 0);
    const nextStepAt = new Date(startIso);
    nextStepAt.setDate(nextStepAt.getDate() + firstStepDelayDays);

    const enrollmentPayload: SequenceEnrollmentInsertRow[] = ownedContactIds.map((contactId) => ({
      sequence_id: sequence.id,
      contact_id: contactId,
      status: "active",
      current_step_index: 0,
      next_step_at: nextStepAt.toISOString(),
      started_at: startIso,
    }));

    const { data: insertedEnrollments, error: enrollmentError } = await supabase
      .from("sequence_enrollments")
      .upsert(enrollmentPayload, {
        onConflict: "sequence_id,contact_id",
        ignoreDuplicates: true,
      })
      .select("id, contact_id");

    if (enrollmentError) {
      return NextResponse.json({ error: enrollmentError.message || "Failed to create enrollments" }, { status: 500 });
    }

    const inserted = (insertedEnrollments ?? []) as InsertedEnrollmentRow[];
    if (inserted.length > 0) {
      const enrollmentStepPayload = inserted.flatMap((enrollment) =>
        orderedSteps.map((step) => ({
          enrollment_id: enrollment.id,
          step_id: step.id,
          status: "pending" as const,
        }))
      );

      const { error: enrollmentStepsError } = await supabase
        .from("sequence_enrollment_steps")
        .insert(enrollmentStepPayload);

      if (enrollmentStepsError) {
        return NextResponse.json(
          { error: enrollmentStepsError.message || "Failed to create enrollment steps" },
          { status: 500 }
        );
      }
    }

    const skipped = dedupedContactIds.length - inserted.length;
    return NextResponse.json({
      enrolled: inserted.length,
      skipped: Math.max(0, skipped),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to enroll contacts" },
      { status: 500 }
    );
  }
}

