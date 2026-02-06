import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/contacts - List all contacts
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build query
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' });
      // .eq('user_id', user.id); // Enable in production

    // Apply search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: contacts, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contacts: contacts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create new contact
export async function POST(request: NextRequest) {
  try {
    // For now, allow unauthenticated access for testing
    // In production, add authentication

    const body = await request.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.company) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, company' },
        { status: 400 }
      );
    }

    // Insert contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Use actual user_id in production
        first_name: body.firstName,
        last_name: body.lastName,
        company: body.company,
        role: body.role || null,
        inferred_email: body.inferredEmail || null,
        email_confidence: body.emailConfidence || null,
        confirmed_email: body.confirmedEmail || null,
        company_domain: body.companyDomain || null,
        company_industry: body.companyIndustry || null,
        company_size: body.companySize || null,
        linkedin_url: body.linkedinUrl || null,
        source: body.source || 'manual',
        status: body.status || 'new',
        notes: body.notes || null,
        tags: body.tags || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact,
      message: 'Contact created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'Failed to create contact', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
