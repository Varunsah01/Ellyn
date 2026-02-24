import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { mapSequenceActionToTrackerContactPatch } from '@/lib/tracker-integration';
import { DraftUpsertSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry';

type DraftDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get('authorization');
  if (!rawAuth) return null;

  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function createRequestScopedSupabaseClient(
  request: Pick<Request, 'headers'>
): Promise<DraftDbClient> {
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
    }) as unknown as DraftDbClient;
  }

  return createServerSupabaseClient();
}

async function syncTrackerContactForDraft(
  supabase: DraftDbClient,
  userId: string,
  contactId: string,
  draftStatus: string | undefined
) {
  if (draftStatus !== 'sent') return;

  try {
    const patch = mapSequenceActionToTrackerContactPatch('mark_sent');
    if (!patch) return;

    const contactPatch: Record<string, string> = {
      status: patch.status,
      updated_at: patch.updated_at,
    };

    if (patch.last_contacted_at) {
      contactPatch.last_contacted_at = patch.last_contacted_at;
    }

    await supabase
      .from('contacts')
      .update(contactPatch)
      .eq('id', contactId)
      .eq('user_id', userId);
  } catch (error) {
    console.warn('[drafts] Failed to sync tracker status', error);
  }
}

// GET /api/drafts - Fetch all drafts
/**
 * Handle GET requests for `/api/drafts`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/drafts request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/drafts
 * fetch('/api/drafts')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createRequestScopedSupabaseClient(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status'); // 'draft' or 'sent'
    const contactId = searchParams.get('contactId');
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, Number.parseInt(searchParams.get('limit') || '100', 10)));

    // Build query
    let query = supabase
      .from('drafts')
      .select('*, contacts(full_name, confirmed_email, inferred_email)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    if (!id) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching drafts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drafts', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      drafts: data || [],
      totalCount: count ?? data?.length ?? 0,
      pagination: {
        page,
        limit,
        total: count ?? data?.length ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? data?.length ?? 0) / limit)),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in GET /api/drafts:', error);
    captureApiException(error, { route: '/api/drafts', method: 'GET' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/drafts - Create or update a draft
/**
 * Handle POST requests for `/api/drafts`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/drafts request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/drafts
 * fetch('/api/drafts', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    const supabase = await createRequestScopedSupabaseClient(request);

    const parsed = DraftUpsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { id, contactId, subject, body: draftBody, status, templateId } = parsed.data;

    // Prepare draft data
    const draftData: Record<string, string | null> = {
      contact_id: contactId,
      subject,
      body: draftBody,
      status: status || 'draft',
      updated_at: new Date().toISOString(),
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    };

    if (templateId !== undefined) {
      draftData.template_id = templateId || null;
    }

    // Update existing draft or create new one
    if (id) {
      const { data, error } = await supabase
        .from('drafts')
        .update(draftData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating draft:', error);
        return NextResponse.json(
          { error: 'Failed to update draft', details: error.message },
          { status: 500 }
        );
      }

      await syncTrackerContactForDraft(supabase, user.id, contactId, draftData.status || undefined);

      return NextResponse.json({
        success: true,
        draft: data,
        message: 'Draft updated successfully',
      });
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('drafts')
        .insert({
          ...draftData,
          user_id: user.id,
          template_id: templateId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating draft:', error);
        return NextResponse.json(
          { error: 'Failed to create draft', details: error.message },
          { status: 500 }
        );
      }

      await syncTrackerContactForDraft(supabase, user.id, contactId, draftData.status || undefined);

      return NextResponse.json({
        success: true,
        draft: data,
        message: 'Draft created successfully',
      }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in POST /api/drafts:', error);
    captureApiException(error, { route: '/api/drafts', method: 'POST' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
