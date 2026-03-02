import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { generateEmailTemplate } from "@/lib/llm-client";
import { incrementAIDraftGeneration, QuotaExceededError } from "@/lib/quota";

const TONES = ["professional", "casual", "friendly", "confident", "humble"] as const;

const GenerateTemplateSchema = z.object({
  context: z.object({
    recipientName: z.string().trim().max(120).optional(),
    recipientRole: z.string().trim().max(120).optional(),
    companyName: z.string().trim().max(160).optional(),
    senderName: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(1).max(2000),
    tone: z.enum(TONES),
  }),
});

function buildPrompt(input: z.infer<typeof GenerateTemplateSchema>["context"]): string {
  return [
    "You are an expert outreach copywriter.",
    "Generate a high-quality email template as JSON.",
    "Return ONLY JSON in this exact shape:",
    '{"subject":"...", "body":"..."}',
    `Tone: ${input.tone}`,
    `Sender name: ${input.senderName}`,
    `Purpose: ${input.purpose}`,
    `Recipient name: ${input.recipientName || "Not specified"}`,
    `Recipient role: ${input.recipientRole || "Not specified"}`,
    `Company name: ${input.companyName || "Not specified"}`,
    "Body should be concise, clear, and actionable.",
  ].join("\n");
}

function parseTemplateResponse(raw: string, senderName: string): { subject: string; body: string } {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate) as { subject?: unknown; body?: unknown };
      const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
      if (subject && body) {
        return { subject, body };
      }
    } catch {
      // Fall through to text fallback.
    }
  }

  const fallbackBody = cleaned || `Hi there,\n\nI wanted to reach out.\n\nBest,\n${senderName}`;
  return {
    subject: "Quick introduction",
    body: fallbackBody,
  };
}

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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const parsed = GenerateTemplateSchema.safeParse(await request.json());
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

    const prompt = buildPrompt(parsed.data.context);
    const raw = await generateEmailTemplate(prompt);
    const template = parseTemplateResponse(raw, parsed.data.context.senderName);

    return NextResponse.json({
      subject: template.subject,
      body: template.body,
      tone: parsed.data.context.tone,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate template" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
