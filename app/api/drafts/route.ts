import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/drafts - Fetch all drafts
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
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/drafts - Create or update a draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, contactId, subject, body: draftBody, status, templateId } = body;

    // Validate required fields
    if (!contactId || !subject || !draftBody) {
      return NextResponse.json(
        { error: 'Missing required fields: contactId, subject, and body are required' },
        { status: 400 }
      );
    }

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

      return NextResponse.json({
        success: true,
        draft: data,
        message: 'Draft created successfully',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/drafts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
