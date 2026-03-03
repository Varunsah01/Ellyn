import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { TemplateCreateSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry';

// GET /api/templates - Fetch all templates (default + custom)
/**
 * Handle GET requests for `/api/templates`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/templates request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/templates
 * fetch('/api/templates')
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();

    // Fetch templates, ordering by is_default (defaults first) then created_at
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: data || [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in GET /api/templates:', error);
    captureApiException(error, { route: '/api/templates', method: 'GET' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new custom template
/**
 * Handle POST requests for `/api/templates`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/templates request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/templates
 * fetch('/api/templates', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();

    const parsed = TemplateCreateSchema.safeParse(await request.json());
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

    // Prepare template data
    const templateData: Record<string, unknown> = {
      name,
      subject,
      body: templateBody,
      is_default: false,
      user_id: user.id,
    };

    if (typeof category === 'string' && category.trim()) {
      templateData.category = category.trim();
    }

    if (typeof tone === 'string' && tone.trim()) {
      templateData.tone = tone.trim();
    }

    if (typeof use_case === 'string' && use_case.trim()) {
      templateData.use_case = use_case.trim();
    }

    if (Array.isArray(variables)) {
      templateData.variables = variables;
    }

    if (Array.isArray(tags)) {
      templateData.tags = tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    if (typeof icon === 'string' && icon.trim()) {
      templateData.icon = icon.trim();
    }

    if (typeof useCount === 'number' && Number.isFinite(useCount)) {
      templateData.use_count = Math.max(0, Math.trunc(useCount));
    }

    // Insert into database
    let { data, error } = await supabase
      .from('email_templates')
      .insert(templateData)
      .select()
      .single();

    // Fallback for databases that do not yet include metadata columns.
    if (error && isUndefinedColumnError(error)) {
      const minimalTemplateData = {
        name,
        subject,
        body: templateBody,
        is_default: false,
        user_id: user.id,
      };

      const fallbackInsert = await supabase
        .from('email_templates')
        .insert(minimalTemplateData)
        .select()
        .single();

      data = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: data,
      message: 'Template created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in POST /api/templates:', error);
    captureApiException(error, { route: '/api/templates', method: 'POST' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function isUndefinedColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message || '';

  return code === '42703' || /column .* does not exist/i.test(message);
}

