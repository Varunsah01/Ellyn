import { NextRequest, NextResponse } from 'next/server';
import { supabase, type Contact, type EmailResult } from '@/lib/supabase';

// GET /api/leads - Fetch all leads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`person_name.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leads', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      leads: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/leads - Create a new lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personName, companyName, emails, selectedEmail } = body;

    // Validate required fields
    if (!personName || !companyName || !emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Missing required fields: personName, companyName, and emails are required' },
        { status: 400 }
      );
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'At least one email must be provided' },
        { status: 400 }
      );
    }

    // Prepare lead data
    const leadData = {
      person_name: personName,
      company_name: companyName,
      discovered_emails: emails,
      selected_email: selectedEmail || null,
      status: 'discovered' as const,
    };

    // Insert into database
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json(
        { error: 'Failed to create lead', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: data,
      message: 'Lead created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
