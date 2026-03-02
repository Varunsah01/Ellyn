import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const TONES = ["professional", "casual", "friendly", "confident", "humble"] as const;

const TemplatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    subject: z.string().trim().min(1).max(220).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    tone: z.enum(TONES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
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

type RouteContext = {
  params: {
    id: string;
  };
};

async function getOwnedTemplate(templateId: string, userId: string) {
  const supabase = await createServiceRoleClient();
  const query = await supabase
    .from("email_templates")
    .select("id, user_id, name, subject, body, tone, is_ai_generated, created_at, updated_at")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle<TemplateRow>();

  return { supabase, ...query };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const { data, error } = await getOwnedTemplate(params.id, user.id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch template" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const owned = await getOwnedTemplate(params.id, user.id);

    if (owned.error) {
      return NextResponse.json({ error: owned.error.message || "Failed to fetch template" }, { status: 500 });
    }
    if (!owned.data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const parsed = TemplatePatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid template payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { data, error } = await owned.supabase
      .from("email_templates")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id, user_id, name, subject, body, tone, is_ai_generated, created_at, updated_at")
      .single<TemplateRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const owned = await getOwnedTemplate(params.id, user.id);

    if (owned.error) {
      return NextResponse.json({ error: owned.error.message || "Failed to fetch template" }, { status: 500 });
    }
    if (!owned.data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const { error } = await owned.supabase
      .from("email_templates")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete template" },
      { status: 500 }
    );
  }
}
