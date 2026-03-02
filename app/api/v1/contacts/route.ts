import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

const CONTACT_STATUSES = ["discovered", "sent", "bounced", "replied"] as const;
const SORT_FIELDS = [
  "created_at",
  "updated_at",
  "first_name",
  "last_name",
  "email",
  "company_name",
  "status",
] as const;

const ContactStatusSchema = z.enum(CONTACT_STATUSES);

const ContactCreateSchema = z.object({
  first_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().min(1).max(120),
  email: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim().toLowerCase();
      },
      z.string().email().max(254).optional()
    )
    .optional(),
  company_name: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().max(160).optional()
    )
    .optional(),
  role: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().max(160).optional()
    )
    .optional(),
  linkedin_url: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().url().max(500).optional()
    )
    .optional(),
  phone: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().max(50).optional()
    )
    .optional(),
  discovery_source: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().max(100).optional()
    )
    .optional(),
  status: ContactStatusSchema.optional(),
  notes: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value !== "string") return value;
        return value.trim();
      },
      z.string().max(5000).optional()
    )
    .optional(),
});

function parsePositiveInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseSort(value: string | null): { field: (typeof SORT_FIELDS)[number]; ascending: boolean } {
  if (!value) {
    return { field: "created_at", ascending: false };
  }

  const [fieldRaw = "created_at", directionRaw = "desc"] = value.split(":");
  const field = SORT_FIELDS.includes(fieldRaw as (typeof SORT_FIELDS)[number])
    ? (fieldRaw as (typeof SORT_FIELDS)[number])
    : "created_at";
  const ascending = directionRaw.toLowerCase() === "asc";
  return { field, ascending };
}

function sanitizeSearch(value: string | null): string {
  if (!value) return "";
  return value.trim().replace(/[,]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

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
};

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const params = request.nextUrl.searchParams;
    const limit = parsePositiveInt(params.get("limit"), 20, 1, 100);
    const offset = parsePositiveInt(params.get("offset"), 0, 0, 1_000_000);
    const search = sanitizeSearch(params.get("search"));
    const statusRaw = params.get("status");
    const status = ContactStatusSchema.safeParse(statusRaw);
    const sort = parseSort(params.get("sort"));

    let query = supabase
      .from("contacts")
      .select(
        "id, user_id, first_name, last_name, email, company_name, role, linkedin_url, phone, discovery_source, status, notes, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", user.id);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
      );
    }

    if (status.success) {
      query = query.eq("status", status.data);
    }

    const { data, error, count } = await query
      .order(sort.field, { ascending: sort.ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch contacts" }, { status: 500 });
    }

    const contacts = Array.isArray(data) ? (data as ContactRow[]) : [];
    const total = count ?? 0;

    return NextResponse.json({
      contacts,
      total,
      hasMore: offset + contacts.length < total,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createServiceRoleClient();

    const parsed = ContactCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid contact payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        ...parsed.data,
        user_id: user.id,
        status: parsed.data.status ?? "discovered",
        discovery_source: parsed.data.discovery_source ?? "manual",
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, user_id, first_name, last_name, email, company_name, role, linkedin_url, phone, discovery_source, status, notes, created_at, updated_at"
      )
      .single<ContactRow>();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create contact" }, { status: 500 });
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create contact" },
      { status: 500 }
    );
  }
}
