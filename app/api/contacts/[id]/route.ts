import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getAuthenticatedUserFromRequest } from "@/lib/auth/helpers";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ContactUpdateSchema,
  formatZodError,
  type ContactUpdateInput,
} from "@/lib/validation/schemas";
import { recordActivity } from "@/lib/utils/recordActivity";

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

async function updateContact(request: NextRequest, id: string, userId: string) {
  try {
    const supabase = await createRequestScopedSupabaseClient(request);
    const parsed = ContactUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: formatZodError(parsed.error),
        },
        { status: 400 }
      );
    }
    const updateData = buildUpdatePayload(parsed.data);

    const { data: contact, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;

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
    return updateContact(request, params.id, user.id);
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
    return updateContact(request, params.id, user.id);
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
