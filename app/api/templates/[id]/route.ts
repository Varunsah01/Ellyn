import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { TemplateUpdateSchema, formatZodError } from '@/lib/validation/schemas';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { captureApiException } from '@/lib/monitoring/sentry';

// GET /api/templates/[id] - Fetch a single template
/**
 * Handle GET requests for `/api/templates/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the GET /api/templates/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/templates/[id]
 * fetch('/api/templates/[id]')
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return NextResponse.json(
        { error: 'Failed to fetch template', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
    });
  } catch (error) {
    console.error('Error in GET /api/templates/[id]:', error);
    captureApiException(error, { route: '/api/templates/[id]', method: 'GET' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/templates/[id] - Update a template
/**
 * Handle PATCH requests for `/api/templates/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the PATCH /api/templates/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // PATCH /api/templates/[id]
 * fetch('/api/templates/[id]', { method: 'PATCH' })
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();
    const { id } = params;
    const parsed = TemplateUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const {
      name,
      subject,
      body: templateBody,
      category,
      tone,
      use_case,
      variables,
      tags,
      icon,
      use_count: useCount,
    } = parsed.data;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updatePayload.name = name;
    }
    if (subject !== undefined) {
      updatePayload.subject = subject;
    }
    if (templateBody !== undefined) {
      updatePayload.body = templateBody;
    }

    if (typeof category === 'string' && category.trim()) {
      updatePayload.category = category.trim();
    }

    if (typeof tone === 'string' && tone.trim()) {
      updatePayload.tone = tone.trim();
    }

    if (typeof use_case === 'string' && use_case.trim()) {
      updatePayload.use_case = use_case.trim();
    }

    if (Array.isArray(variables)) {
      updatePayload.variables = variables;
    }

    if (Array.isArray(tags)) {
      updatePayload.tags = tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    if (typeof icon === 'string' && icon.trim()) {
      updatePayload.icon = icon.trim();
    }

    if (typeof useCount === 'number' && Number.isFinite(useCount)) {
      updatePayload.use_count = Math.max(0, Math.trunc(useCount));
    }

    let { data, error } = await supabase
      .from('email_templates')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    // Fallback for DBs that do not include metadata columns yet.
    if (error && isUndefinedColumnError(error)) {
      const fallbackUpdatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) {
        fallbackUpdatePayload.name = name;
      }
      if (subject !== undefined) {
        fallbackUpdatePayload.subject = subject;
      }
      if (templateBody !== undefined) {
        fallbackUpdatePayload.body = templateBody;
      }

      const fallbackUpdate = await supabase
        .from('email_templates')
        .update(fallbackUpdatePayload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      data = fallbackUpdate.data;
      error = fallbackUpdate.error;
    }

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json(
        { error: 'Failed to update template', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
      message: 'Template updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in PATCH /api/templates/[id]:', error);
    captureApiException(error, { route: '/api/templates/[id]', method: 'PATCH' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
/**
 * Handle DELETE requests for `/api/templates/[id]`.
 * @param {NextRequest} request - Request input.
 * @param {{ params: { id: string } }} param2 - Param2 input.
 * @returns {unknown} JSON response for the DELETE /api/templates/[id] request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // DELETE /api/templates/[id]
 * fetch('/api/templates/[id]', { method: 'DELETE' })
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();
    const { id } = params;

    // Prevent deletion of default templates
    const { data: template } = await supabase
      .from('email_templates')
      .select('is_default, user_id')
      .eq('id', id)
      .single();

    if (template?.is_default) {
      return NextResponse.json(
        { error: 'Default templates cannot be deleted. Duplicate them to customize.' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { error: 'Failed to delete template', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in DELETE /api/templates/[id]:', error);
    captureApiException(error, { route: '/api/templates/[id]', method: 'DELETE' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message || '';

  return code === '42703' || /column .* does not exist/i.test(message);
}
