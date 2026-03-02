import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { generateEmailTemplate } from "@/lib/llm-client";
import { incrementAIDraftGeneration, QuotaExceededError } from "@/lib/quota";

const EnhanceDraftSchema = z.object({
  subject: z.string().trim().min(1).max(220),
  body: z.string().trim().min(1).max(12000),
  instructions: z.string().trim().min(1).max(2000),
});

function quotaExceededResponse(error: QuotaExceededError) {
  return NextResponse.json(
    {
      error: "quota_exceeded",
      feature: error.feature,
      used: error.used,
      limit: error.limit,
      plan_type: error.plan_type,
      upgrade_url: "/dashboard/upgrade",
    },
    { status: 402 }
  );
}

function buildPrompt(input: z.infer<typeof EnhanceDraftSchema>): string {
  return [
    "You are an expert outreach copywriter.",
    "Enhance the draft while preserving intent.",
    "Return ONLY JSON in this exact shape:",
    '{"subject":"...", "body":"..."}',
    `Current subject: ${input.subject}`,
    "Current body:",
    input.body,
    `Enhancement instructions: ${input.instructions}`,
  ].join("\n");
}

function parseResponse(raw: string, fallbackSubject: string, fallbackBody: string) {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as {
        subject?: unknown;
        body?: unknown;
      };
      const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
      if (subject && body) {
        return { subject, body };
      }
    } catch {
      // fall through
    }
  }

  return { subject: fallbackSubject, body: cleaned || fallbackBody };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const parsed = EnhanceDraftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid request payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    try {
      await incrementAIDraftGeneration(user.id);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return quotaExceededResponse(error);
      }
      throw error;
    }

    const raw = await generateEmailTemplate(buildPrompt(parsed.data));
    const enhanced = parseResponse(raw, parsed.data.subject, parsed.data.body);

    return NextResponse.json({
      subject: enhanced.subject,
      body: enhanced.body,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to enhance draft" },
      { status: 500 }
    );
  }
}
