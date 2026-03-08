import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isMissingDbObjectError } from "@/app/api/analytics/_helpers";
import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const TrackerStatusSchema = z.enum([
  "saved",
  "applied",
  "interviewing",
  "offered",
  "rejected",
]);

const UpdateApplicationSchema = z
  .object({
    company_name: z.string().trim().min(1, "Company name is required").optional(),
    role: z.string().trim().min(1, "Role is required").optional(),
    status: TrackerStatusSchema.optional(),
    applied_date: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    notes: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    job_url: z
      .string()
      .trim()
      .url("Job URL must be a valid URL")
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type RouteParams = {
  params: Promise<{ id: string }>;
};

function trackerSchemaMissingResponse() {
  return NextResponse.json(
    { error: "Tracker schema is missing. Apply the Supabase reconciliation migration." },
    { status: 503 }
  );
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const { id } = await context.params;
    const body = await request.json();
    const parsed = UpdateApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from("application_tracker")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, user_id, company_name, role, status, applied_date, notes, job_url, created_at")
      .maybeSingle();

    if (error) {
      if (isMissingDbObjectError(error)) {
        return trackerSchemaMissingResponse();
      }
      return NextResponse.json({ error: error.message || "Failed to update application" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ application: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update application" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const { id } = await context.params;
    const supabase = await createServiceRoleClient();

    const { data: existing, error: existingError } = await supabase
      .from("application_tracker")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      if (isMissingDbObjectError(existingError)) {
        return trackerSchemaMissingResponse();
      }
      return NextResponse.json({ error: existingError.message || "Failed to delete application" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("application_tracker")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      if (isMissingDbObjectError(error)) {
        return trackerSchemaMissingResponse();
      }
      return NextResponse.json({ error: error.message || "Failed to delete application" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete application" },
      { status: 500 }
    );
  }
}
