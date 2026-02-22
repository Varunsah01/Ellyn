import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { TemplateCreateSchema, formatZodError } from '@/lib/validation/schemas';

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
export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

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

    // If user has no templates at all, seed the defaults
    if (!data || data.length === 0) {
      const defaultTemplates = [
        {
          name: 'Cold Outreach',
          subject: 'Quick question about {{company}}',
          body: `Hi {{firstName}},\n\nI came across {{company}} and was impressed by your work in {{industry}}.\n\nI wanted to reach out because [YOUR REASON HERE].\n\nWould you be open to a quick chat this week?\n\nBest regards,\n[YOUR NAME]`,
          is_default: true,
          user_id: user.id,
          category: 'outreach',
          icon: '📧',
        },
        {
          name: 'Follow Up',
          subject: 'Following up - {{company}}',
          body: `Hi {{firstName}},\n\nI wanted to follow up on my previous email about [TOPIC].\n\nI believe there could be value in connecting, especially regarding [SPECIFIC VALUE PROPOSITION].\n\nLet me know if you'd like to schedule a brief call.\n\nThanks,\n[YOUR NAME]`,
          is_default: true,
          user_id: user.id,
          category: 'follow-up',
          icon: '🔄',
        },
        {
          name: 'Introduction',
          subject: 'Introduction - {{yourName}} + {{firstName}}',
          body: `Hi {{firstName}},\n\nMy name is {{yourName}} and I work on [YOUR WORK/COMPANY].\n\nI noticed you're at {{company}} and thought we might have some interesting synergies around [TOPIC/AREA].\n\nWould love to connect if you have 15 minutes in the coming weeks.\n\nBest,\n{{yourName}}`,
          is_default: true,
          user_id: user.id,
          category: 'introduction',
          icon: '👋',
        },
        {
          name: 'Value Proposition',
          subject: 'Helping {{company}} with [SPECIFIC OUTCOME]',
          body: `Hi {{firstName}},\n\nI help companies like {{company}} achieve [SPECIFIC OUTCOME] through [YOUR SOLUTION].\n\nSome recent results:\n• [RESULT 1]\n• [RESULT 2]\n• [RESULT 3]\n\nWould you be interested in learning more?\n\nLooking forward to hearing from you,\n[YOUR NAME]`,
          is_default: true,
          user_id: user.id,
          category: 'value-prop',
          icon: '💡',
        },
      ];

      const { data: seeded, error: seedError } = await supabase
        .from('email_templates')
        .insert(defaultTemplates)
        .select();

      if (!seedError && seeded) {
        return NextResponse.json({ success: true, templates: seeded });
      }
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
