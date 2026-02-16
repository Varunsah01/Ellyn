import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/templates/[id] - Fetch a single template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/templates/[id] - Update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      name,
      subject,
      body: templateBody,
      updated_at: new Date().toISOString(),
    };

    if (typeof category === 'string' && category.trim()) {
      updatePayload.category = category.trim();
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
      .select()
      .single();

    // Fallback for DBs that do not include metadata columns yet.
    if (error && isUndefinedColumnError(error)) {
      const fallbackUpdate = await supabase
        .from('email_templates')
        .update({
          name,
          subject,
          body: templateBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
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
    console.error('Error in PATCH /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);

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
    console.error('Error in DELETE /api/templates/[id]:', error);
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
