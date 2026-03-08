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

const CreateApplicationSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required"),
  role: z.string().trim().min(1, "Role is required"),
  status: TrackerStatusSchema.optional().default("saved"),
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
});

type TrackerApplicationRow = {
  id: string;
  user_id: string;
  company_name: string;
  role: string;
  status: z.infer<typeof TrackerStatusSchema>;
  applied_date: string | null;
  notes: string | null;
  job_url: string | null;
  created_at: string;
};

function trackerSchemaMissingResponse() {
  return NextResponse.json(
    { error: "Tracker schema is missing. Apply the Supabase reconciliation migration." },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from("application_tracker")
      .select("id, user_id, company_name, role, status, applied_date, notes, job_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingDbObjectError(error)) {
        return trackerSchemaMissingResponse();
      }
      return NextResponse.json({ error: error.message || "Failed to fetch applications" }, { status: 500 });
    }

    return NextResponse.json({ applications: (data ?? []) as TrackerApplicationRow[] });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const body = await request.json();
    const parsed = CreateApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from("application_tracker")
      .insert({
        user_id: user.id,
        company_name: parsed.data.company_name,
        role: parsed.data.role,
        status: parsed.data.status,
        applied_date: parsed.data.applied_date,
        notes: parsed.data.notes,
        job_url: parsed.data.job_url,
      })
      .select("id, user_id, company_name, role, status, applied_date, notes, job_url, created_at")
      .single();

    if (error) {
      if (isMissingDbObjectError(error)) {
        return trackerSchemaMissingResponse();
      }
      return NextResponse.json({ error: error.message || "Failed to create application" }, { status: 500 });
    }

    return NextResponse.json({ application: data as TrackerApplicationRow }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create application" },
      { status: 500 }
    );
  }
}
