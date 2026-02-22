import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { LeadUpdateSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry';

// PATCH /api/leads/[id] - Update a lead
/**
 * Handle PATCH requests for `/api/leads/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the PATCH /api/leads/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PATCH /api/leads/[id]
 * fetch('/api/leads/[id]', { method: 'PATCH' })
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = params;
    const parsed = LeadUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { status, selectedEmail } = parsed.data;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updateData.status = status;
    if (selectedEmail !== undefined) updateData.selected_email = selectedEmail;

    // Update in database
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update lead', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: data,
      message: 'Lead updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in PATCH /api/leads/[id]:', error);
    captureApiException(error, { route: '/api/leads/[id]', method: 'PATCH' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] - Delete a lead
/**
 * Handle DELETE requests for `/api/leads/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the DELETE /api/leads/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // DELETE /api/leads/[id]
 * fetch('/api/leads/[id]', { method: 'DELETE' })
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = params;

    // Delete from database
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting lead:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to delete lead', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in DELETE /api/leads/[id]:', error);
    captureApiException(error, { route: '/api/leads/[id]', method: 'DELETE' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/leads/[id] - Get a single lead
/**
 * Handle GET requests for `/api/leads/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the GET /api/leads/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/leads/[id]
 * fetch('/api/leads/[id]')
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = params;

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lead not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch lead', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: data,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in GET /api/leads/[id]:', error);
    captureApiException(error, { route: '/api/leads/[id]', method: 'GET' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
