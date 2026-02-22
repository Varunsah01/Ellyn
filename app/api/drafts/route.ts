import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { mapSequenceActionToTrackerContactPatch } from '@/lib/tracker-integration';
import { DraftUpsertSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry'

async function syncTrackerContactForDraft(contactId: string, draftStatus: string | undefined) {
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

    await supabase.from('contacts').update(contactPatch).eq('id', contactId);
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'draft' or 'sent'
    const contactId = searchParams.get('contactId');

    // Build query
    let query = supabase
      .from('drafts')
      .select('*, contacts(full_name, confirmed_email, inferred_email)')
      .order('updated_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error } = await query;

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
    });
  } catch (error) {
    console.error('Error in GET /api/drafts:', error);
    captureApiException(error, { route: '/api/drafts', method: 'GET' })
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
    const parsed = DraftUpsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { id, contactId, subject, body: draftBody, status, templateId } = parsed.data;

    // Prepare draft data
    const draftData: any = {
      contact_id: contactId,
      subject,
      body: draftBody,
      status: status || 'draft',
      updated_at: new Date().toISOString(),
    };

    if (templateId) {
      draftData.template_id = templateId;
    }

    // Update existing draft or create new one
    if (id) {
      const { data, error } = await supabase
        .from('drafts')
        .update(draftData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating draft:', error);
        return NextResponse.json(
          { error: 'Failed to update draft', details: error.message },
          { status: 500 }
        );
      }

      await syncTrackerContactForDraft(contactId, draftData.status);

      return NextResponse.json({
        success: true,
        draft: data,
        message: 'Draft updated successfully',
      });
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('drafts')
        .insert(draftData)
        .select()
        .single();

      if (error) {
        console.error('Error creating draft:', error);
        return NextResponse.json(
          { error: 'Failed to create draft', details: error.message },
          { status: 500 }
        );
      }

      await syncTrackerContactForDraft(contactId, draftData.status);

      return NextResponse.json({
        success: true,
        draft: data,
        message: 'Draft created successfully',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/drafts:', error);
    captureApiException(error, { route: '/api/drafts', method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
