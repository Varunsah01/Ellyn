import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const TONES = ["professional", "casual", "friendly", "confident", "humble"] as const;

const TemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(220),
  body: z.string().trim().min(1).max(10000),
  tone: z.enum(TONES).default("professional"),
  is_ai_generated: z.boolean().optional(),
});

type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  tone: (typeof TONES)[number] | null;
  is_ai_generated: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from("email_templates")
      .select("id, user_id, name, subject, body, tone, is_ai_generated, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch templates" }, { status: 500 });
    }

    return NextResponse.json({
      templates: (data ?? []) as TemplateRow[],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = TemplateCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid template payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: parsed.data.body,
        tone: parsed.data.tone,
        is_ai_generated: Boolean(parsed.data.is_ai_generated),
        created_at: now,
        updated_at: now,
      })
      .select("id, user_id, name, subject, body, tone, is_ai_generated, created_at, updated_at")
      .single<TemplateRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 }
    );
  }
}
