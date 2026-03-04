import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { err, unauthorized, notFound, validationError } from "@/lib/api/response";
import { checkApiRateLimit, rateLimitExceeded } from "@/lib/rate-limit";

const CONTACT_STATUSES = ["discovered", "sent", "bounced", "replied"] as const;
const ContactStatusSchema = z.enum(CONTACT_STATUSES);

const ContactPatchSchema = z
  .object({
    first_name: z.string().trim().min(1).max(120).optional(),
    last_name: z.string().trim().min(1).max(120).optional(),
    email: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim().toLowerCase();
        },
        z.union([z.string().email().max(254), z.null()]).optional()
      )
      .optional(),
    company_name: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().max(160), z.null()]).optional()
      )
      .optional(),
    role: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().max(160), z.null()]).optional()
      )
      .optional(),
    linkedin_url: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().url().max(500), z.null()]).optional()
      )
      .optional(),
    phone: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().max(50), z.null()]).optional()
      )
      .optional(),
    discovery_source: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().max(100), z.null()]).optional()
      )
      .optional(),
    status: ContactStatusSchema.optional(),
    notes: z
      .preprocess(
        (value) => {
          if (value === null) return null;
          if (value === undefined || value === "") return undefined;
          if (typeof value !== "string") return value;
          return value.trim();
        },
        z.union([z.string().max(5000), z.null()]).optional()
      )
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type ContactRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  role: string | null;
  linkedin_url: string | null;
  phone: string | null;
  discovery_source: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  lead_score_cache: number | null;
  lead_score_grade: "hot" | "warm" | "cold" | null;
  lead_score_computed_at: string | null;
};

type RouteContext = {
  params: {
    id: string;
  };
};

async function getOwnedContact(contactId: string, userId: string) {
  const supabase = await createServiceRoleClient();
  const query = await supabase
    .from("contacts")
    .select(
      "id, user_id, first_name, last_name, email, company_name, role, linkedin_url, phone, discovery_source, status, notes, created_at, updated_at, lead_score_cache, lead_score_grade, lead_score_computed_at"
    )
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle<ContactRow>();

  return { supabase, ...query };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const { data, error } = await getOwnedContact(params.id, user.id);

    if (error) return err(error.message || "Failed to fetch contact", 500);
    if (!data) return notFound("Contact");

    return NextResponse.json({ contact: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to fetch contact", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const rl = await checkApiRateLimit(`contact-patch:${user.id}`, 30, 300);
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt);

    const owned = await getOwnedContact(params.id, user.id);
    if (owned.error) return err(owned.error.message || "Failed to fetch contact", 500);
    if (!owned.data) return notFound("Contact");

    const parsed = ContactPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.issues);
    }

    const { data, error } = await owned.supabase
      .from("contacts")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(
        "id, user_id, first_name, last_name, email, company_name, role, linkedin_url, phone, discovery_source, status, notes, created_at, updated_at, lead_score_cache, lead_score_grade, lead_score_computed_at"
      )
      .single<ContactRow>();

    if (error) return err(error.message || "Failed to update contact", 500);

    return NextResponse.json({ contact: data });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to update contact", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const rl = await checkApiRateLimit(`contact-delete:${user.id}`, 10, 300);
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt);

    const owned = await getOwnedContact(params.id, user.id);
    if (owned.error) return err(owned.error.message || "Failed to fetch contact", 500);
    if (!owned.data) return notFound("Contact");

    const { error } = await owned.supabase
      .from("contacts")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) return err(error.message || "Failed to delete contact", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return unauthorized();
    return err(error instanceof Error ? error.message : "Failed to delete contact", 500);
  }
}
