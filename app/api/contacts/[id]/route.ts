import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import {
  createClient as createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import {
  ContactUpdateSchema,
  formatZodError,
  type ContactUpdateInput,
} from "@/lib/validation/schemas";
import { recordActivity } from "@/lib/utils/recordActivity";
import { captureApiException } from '@/lib/monitoring/sentry'
import { delete as deleteCache } from "@/lib/cache/redis";

type ContactDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get("authorization");
  if (!rawAuth) return null;

  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function createRequestScopedSupabaseClient(
  request: Pick<Request, "headers">
): Promise<ContactDbClient> {
  const token = extractBearerToken(request.headers);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (token && supabaseUrl && supabaseAnonKey) {
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }) as unknown as ContactDbClient;
  }

  return createServerSupabaseClient();
}

interface RouteContext {
  params: { id: string };
}

const ContactStatusEnum = z.enum(["new", "contacted", "replied", "no_response"]);
const SafeTagSchema = z.string().trim().min(1).max(20);
const SetTagsSchema = z
  .array(SafeTagSchema)
  .max(10)
  .transform((tags) => Array.from(new Set(tags)));

const NonUpdateOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_tag"), tag: SafeTagSchema }),
  z.object({ op: z.literal("remove_tag"), tag: SafeTagSchema }),
  z.object({ op: z.literal("set_tags"), tags: SetTagsSchema }),
  z.object({ op: z.literal("set_notes"), notes: z.string().max(500) }),
  z.object({ op: z.literal("set_status"), status: ContactStatusEnum }),
  z.object({ op: z.literal("set_stage"), stage_id: z.string().uuid().nullable() }),
]);

type UpdateOperationInput = { op: "update" } & ContactUpdateInput;
type ContactOperationInput = z.infer<typeof NonUpdateOperationSchema> | UpdateOperationInput;

function normalizeExistingTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(normalized));
}

// GET /api/contacts/[id] - Get single contact
/**
 * Handle GET requests for `/api/contacts/[id]`.
 * @param {NextRequest} _request -  request input.
 * @param {RouteContext} param2 - Param2 input.
 * @returns {unknown} JSON response for the GET /api/contacts/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/contacts/[id]
 * fetch('/api/contacts/[id]')
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createRequestScopedSupabaseClient(request);
    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get contact error:", error);
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
}

function buildUpdatePayload(body: ContactUpdateInput) {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.firstName !== undefined) updateData.first_name = body.firstName;
  if (body.lastName !== undefined) updateData.last_name = body.lastName;
  if (body.company !== undefined) updateData.company = body.company;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.inferredEmail !== undefined) updateData.inferred_email = body.inferredEmail;
  if (body.confirmedEmail !== undefined) updateData.confirmed_email = body.confirmedEmail;
  if (body.emailConfidence !== undefined) updateData.email_confidence = body.emailConfidence;
  if (body.companyDomain !== undefined) updateData.company_domain = body.companyDomain;
  if (body.companyIndustry !== undefined) updateData.company_industry = body.companyIndustry;
  if (body.companySize !== undefined) updateData.company_size = body.companySize;
  if (body.linkedinUrl !== undefined) updateData.linkedin_url = body.linkedinUrl;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.lastContactedAt !== undefined) updateData.last_contacted_at = body.lastContactedAt;

  return updateData;
}

async function updateContact(
  request: NextRequest,
  id: string,
  userId: string,
  method: "PUT" | "PATCH"
) {
  try {
    const supabase = await createServiceRoleClient();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { data: existingContact, error: existingError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    let operation: ContactOperationInput;
    if (typeof body === "object" && body !== null && (body as { op?: unknown }).op === "update") {
      const parsedUpdate = ContactUpdateSchema.safeParse(body);
      if (!parsedUpdate.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: formatZodError(parsedUpdate.error),
          },
          { status: 400 }
        );
      }
      operation = { op: "update", ...parsedUpdate.data };
    } else {
      const parsedOperation = NonUpdateOperationSchema.safeParse(body);
      if (parsedOperation.success) {
        operation = parsedOperation.data;
      } else {
        const fallbackUpdate = ContactUpdateSchema.safeParse(body);
        if (!fallbackUpdate.success) {
          return NextResponse.json(
            {
              error: "Validation failed",
              details: formatZodError(parsedOperation.error),
            },
            { status: 400 }
          );
        }
        operation = { op: "update", ...fallbackUpdate.data };
      }
    }

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let shouldInvalidateTagsCache = false;
    let nextStatus: string | null = null;
    let contactForNoOp: Record<string, unknown> | null = null;

    switch (operation.op) {
      case "update": {
        const { op, ...fields } = operation;
        void op;
        if (
          Array.isArray((fields as ContactUpdateInput).tags) &&
          (fields as ContactUpdateInput).tags!.length > 10
        ) {
          return NextResponse.json(
            { error: "A contact can have at most 10 tags" },
            { status: 400 }
          );
        }
        if (Array.isArray((fields as ContactUpdateInput).tags)) {
          shouldInvalidateTagsCache = true;
        }
        updateData = buildUpdatePayload(fields as ContactUpdateInput);
        break;
      }
      case "add_tag": {
        const existingTags = normalizeExistingTags(existingContact.tags);
        if (existingTags.includes(operation.tag)) {
          contactForNoOp = existingContact;
          break;
        }
        if (existingTags.length >= 10) {
          return NextResponse.json(
            { error: "A contact can have at most 10 tags" },
            { status: 400 }
          );
        }
        shouldInvalidateTagsCache = true;
        updateData = {
          tags: [...existingTags, operation.tag],
          updated_at: new Date().toISOString(),
        };
        break;
      }
      case "remove_tag": {
        const existingTags = normalizeExistingTags(existingContact.tags);
        const nextTags = existingTags.filter((tag) => tag !== operation.tag);
        if (nextTags.length === existingTags.length) {
          contactForNoOp = existingContact;
          break;
        }
        shouldInvalidateTagsCache = true;
        updateData = {
          tags: nextTags,
          updated_at: new Date().toISOString(),
        };
        break;
      }
      case "set_tags": {
        const tags = Array.from(new Set(operation.tags.map((tag) => tag.trim()))).filter(
          Boolean
        );
        if (tags.length > 10) {
          return NextResponse.json(
            { error: "A contact can have at most 10 tags" },
            { status: 400 }
          );
        }
        shouldInvalidateTagsCache = true;
        updateData = {
          tags,
          updated_at: new Date().toISOString(),
        };
        break;
      }
      case "set_notes": {
        updateData = {
          notes: operation.notes,
          updated_at: new Date().toISOString(),
        };
        break;
      }
      case "set_status": {
        if (existingContact.status !== operation.status) {
          nextStatus = operation.status;
        }
        updateData = {
          status: operation.status,
          updated_at: new Date().toISOString(),
        };
        break;
      }
      case "set_stage": {
        if (operation.stage_id) {
          const { data: stage, error: stageError } = await supabase
            .from("application_stages")
            .select("id")
            .eq("id", operation.stage_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (stageError) throw stageError;
          if (!stage) {
            return NextResponse.json({ error: "Stage not found" }, { status: 404 });
          }
        }
        updateData = {
          stage_id: operation.stage_id,
          updated_at: new Date().toISOString(),
        };
        break;
      }
      default: {
        return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
      }
    }

    if (contactForNoOp) {
      return NextResponse.json(
        { success: true, contact: contactForNoOp, message: "Contact updated successfully" },
        { headers: { "X-Trigger-Refresh": "contacts,stats" } }
      );
    }

    const { data: contact, error: updateError } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if (shouldInvalidateTagsCache) {
      void deleteCache(`contact-tags:${userId}`).catch((cacheError) => {
        console.error("[contacts/[id]] Failed to invalidate tags cache", cacheError);
      });
    }

    if (operation.op === "set_status" && nextStatus) {
      void (async () => {
        try {
          await supabase.from("activity_log").insert({
            user_id: userId,
            type: `status_changed_to_${nextStatus}`,
            description: `Status changed to ${nextStatus}`,
            contact_id: id,
            metadata: {
              previous_status: existingContact.status,
              action: `status_changed_to_${nextStatus}`,
            },
          });
        } catch (logError) {
          console.error(logError);
        }
      })();
    }

    recordActivity({
      userId,
      type: 'contact_updated',
      description: `Updated ${contact.first_name} ${contact.last_name}`,
      contactId: contact.id,
      metadata: { contactName: `${contact.first_name} ${contact.last_name}`, company: contact.company },
    })

    return NextResponse.json(
      { success: true, contact, message: "Contact updated successfully" },
      { headers: { "X-Trigger-Refresh": "contacts,stats" } }
    );
  } catch (error) {
    console.error("Update contact error:", error);
    captureApiException(error, { route: "/api/contacts/[id]", method })
    return NextResponse.json(
      {
        error: "Failed to update contact",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT /api/contacts/[id] - Full update (supported for backward compatibility)
/**
 * Handle PUT requests for `/api/contacts/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {RouteContext} param2 - Param2 input.
 * @returns {unknown} JSON response for the PUT /api/contacts/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PUT /api/contacts/[id]
 * fetch('/api/contacts/[id]', { method: 'PUT' })
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    return updateContact(request, params.id, user.id, "PUT");
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update contact error:", error);
    return NextResponse.json(
      {
        error: "Failed to update contact",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/contacts/[id] - Partial update
/**
 * Handle PATCH requests for `/api/contacts/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {RouteContext} param2 - Param2 input.
 * @returns {unknown} JSON response for the PATCH /api/contacts/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PATCH /api/contacts/[id]
 * fetch('/api/contacts/[id]', { method: 'PATCH' })
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    return updateContact(request, params.id, user.id, "PATCH");
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update contact error:", error);
    return NextResponse.json(
      {
        error: "Failed to update contact",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id] - Delete contact
/**
 * Handle DELETE requests for `/api/contacts/[id]`.
 * @param {NextRequest} _request -  request input.
 * @param {RouteContext} param2 - Param2 input.
 * @returns {unknown} JSON response for the DELETE /api/contacts/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // DELETE /api/contacts/[id]
 * fetch('/api/contacts/[id]', { method: 'DELETE' })
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createRequestScopedSupabaseClient(request);
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json(
      { success: true, message: "Contact deleted successfully" },
      { headers: { "X-Trigger-Refresh": "contacts,stats" } }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Delete contact error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete contact",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
