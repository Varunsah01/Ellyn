import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EnrollmentPatchSchema = z.object({
  status: z.enum(["active", "paused"]),
});

type SequenceOwnershipRow = {
  id: string;
  user_id: string;
};

type EnrollmentRow = {
  id: string;
  sequence_id: string;
  status: "active" | "paused" | "completed" | "bounced" | null;
  current_step_index: number | null;
  next_step_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type RouteContext = {
  params: {
    id: string;
    enrollmentId: string;
  };
};

async function getOwnedSequence(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  sequenceId: string,
  userId: string
) {
  return supabase
    .from("sequences")
    .select("id, user_id")
    .eq("id", sequenceId)
    .eq("user_id", userId)
    .maybeSingle<SequenceOwnershipRow>();
}

async function getEnrollment(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  enrollmentId: string,
  sequenceId: string
) {
  return supabase
    .from("sequence_enrollments")
    .select("id, sequence_id, status, current_step_index, next_step_at, started_at, completed_at")
    .eq("id", enrollmentId)
    .eq("sequence_id", sequenceId)
    .maybeSingle<EnrollmentRow>();
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const ownership = await getOwnedSequence(supabase, params.id, user.id);
    if (ownership.error) {
      return NextResponse.json({ error: ownership.error.message || "Failed to verify sequence ownership" }, { status: 500 });
    }

    if (!ownership.data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const parsed = EnrollmentPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid enrollment payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const enrollment = await getEnrollment(supabase, params.enrollmentId, params.id);
    if (enrollment.error) {
      return NextResponse.json({ error: enrollment.error.message || "Failed to fetch enrollment" }, { status: 500 });
    }

    if (!enrollment.data) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const nextStatus = parsed.data.status;
    const { data, error } = await supabase
      .from("sequence_enrollments")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "active" ? null : enrollment.data.completed_at,
      })
      .eq("id", params.enrollmentId)
      .eq("sequence_id", params.id)
      .select("id, sequence_id, status, current_step_index, next_step_at, started_at, completed_at")
      .single<EnrollmentRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update enrollment" }, { status: 500 });
    }

    return NextResponse.json({ enrollment: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update enrollment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const ownership = await getOwnedSequence(supabase, params.id, user.id);
    if (ownership.error) {
      return NextResponse.json({ error: ownership.error.message || "Failed to verify sequence ownership" }, { status: 500 });
    }

    if (!ownership.data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const enrollment = await getEnrollment(supabase, params.enrollmentId, params.id);
    if (enrollment.error) {
      return NextResponse.json({ error: enrollment.error.message || "Failed to fetch enrollment" }, { status: 500 });
    }

    if (!enrollment.data) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("sequence_enrollments")
      .delete()
      .eq("id", params.enrollmentId)
      .eq("sequence_id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to remove enrollment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove enrollment" },
      { status: 500 }
    );
  }
}
