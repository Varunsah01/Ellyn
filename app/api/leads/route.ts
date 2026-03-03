import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { LeadCreateSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry';

// GET /api/leads - Fetch all leads
/**
 * Handle GET requests for `/api/leads`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/leads request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/leads
 * fetch('/api/leads')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();
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
      .eq('user_id', user.id)
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in GET /api/leads:', error);
    captureApiException(error, { route: '/api/leads', method: 'GET' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/leads - Create a new lead
/**
 * Handle POST requests for `/api/leads`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/leads request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/leads
 * fetch('/api/leads', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const supabase = await createServiceRoleClient();
    const parsed = LeadCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { personName, companyName, emails, selectedEmail, status } = parsed.data;

    // Prepare lead data
    const leadData = {
      user_id: user.id,
      person_name: personName,
      company_name: companyName,
      discovered_emails: emails,
      selected_email: selectedEmail || null,
      status: status || ('discovered' as const),
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in POST /api/leads:', error);
    captureApiException(error, { route: '/api/leads', method: 'POST' });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
