import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/templates - Fetch all templates (default + custom)
export async function GET(request: NextRequest) {
  try {
    // For now, allow unauthenticated access for testing
    // In production, add authentication:
    /*
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */

    // Fetch templates, ordering by is_default (defaults first) then created_at
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
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
    console.error('Error in GET /api/templates:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new custom template
export async function POST(request: NextRequest) {
  try {
    // For now, allow unauthenticated access for testing
    // In production, add authentication and user_id
    /*
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */

    const body = await request.json();
    const {
      name,
      subject,
      body: templateBody,
      category,
      tags,
      icon,
      use_count: useCount,
    } = body as {
      name?: string;
      subject?: string;
      body?: string;
      category?: string;
      tags?: string[];
      icon?: string;
      use_count?: number;
    };

    // Validate required fields
    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, and body are required' },
        { status: 400 }
      );
    }

    // Prepare template data
    const templateData: Record<string, unknown> = {
      name,
      subject,
      body: templateBody,
      is_default: false,
      // user_id: user.id, // Add this in production
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
