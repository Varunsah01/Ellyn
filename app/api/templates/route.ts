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
    const { name, subject, body: templateBody } = body;

    // Validate required fields
    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, and body are required' },
        { status: 400 }
      );
    }

    // Prepare template data
    const templateData = {
      name,
      subject,
      body: templateBody,
      is_default: false,
      // user_id: user.id, // Add this in production
    };

    // Insert into database
    const { data, error } = await supabase
      .from('email_templates')
      .insert(templateData)
      .select()
      .single();

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
