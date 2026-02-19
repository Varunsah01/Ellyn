import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers';
import { ContactCreateSchema, formatZodError } from '@/lib/validation/schemas';
import { recordActivity } from '@/lib/utils/recordActivity';

// GET /api/contacts - List all contacts
/**
 * Handle GET requests for `/api/contacts`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/contacts request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/contacts
 * fetch('/api/contacts')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const since = searchParams.get('since') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeOutreach = searchParams.get('includeOutreach') !== 'false';

    // Build query
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply source filter
    if (source) {
      query = query.eq('source', source);
    }

    // Apply since filter (supports '24h')
    if (since === '24h') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoff);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: contacts, error, count } = await query;

    if (error) throw error;

    let contactsWithOutreach = contacts || [];

    if (includeOutreach && contactsWithOutreach.length > 0) {
      const contactIds = contactsWithOutreach.map((contact) => contact.id).filter(Boolean);

      if (contactIds.length > 0) {
        // Best-effort enrichment with latest outreach status per contact.
        // This remains optional because older schemas may not expose contact_id.
        const { data: outreachRows, error: outreachError } = await supabase
          .from('outreach')
          .select('contact_id, status, updated_at, created_at')
          .eq('user_id', user.id)
          .in('contact_id', contactIds)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false, nullsFirst: false });

        if (!outreachError && outreachRows) {
          const latestStatusByContact = new Map<string, string>();

          for (const row of outreachRows) {
            if (row.contact_id && !latestStatusByContact.has(row.contact_id)) {
              latestStatusByContact.set(row.contact_id, row.status);
            }
          }

          contactsWithOutreach = contactsWithOutreach.map((contact) => ({
            ...contact,
            outreach_status: latestStatusByContact.get(contact.id) || null,
          }));
        }
      }
    }

    return NextResponse.json({
      success: true,
      contacts: contactsWithOutreach,
      totalCount: count || 0,
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
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create new contact
/**
 * Handle POST requests for `/api/contacts`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/contacts request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/contacts
 * fetch('/api/contacts', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);

    const parsed = ContactCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Insert contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user.id,
        first_name: body.firstName,
        last_name: body.lastName,
        company: body.company,
        role: body.role ?? null,
        inferred_email: body.inferredEmail ?? null,
        email_confidence: body.emailConfidence ?? null,
        confirmed_email: body.confirmedEmail ?? null,
        company_domain: body.companyDomain ?? null,
        company_industry: body.companyIndustry ?? null,
        company_size: body.companySize ?? null,
        linkedin_url: body.linkedinUrl ?? null,
        source: body.source || 'manual',
        status: body.status || 'new',
        notes: body.notes ?? null,
        tags: body.tags || [],
      })
      .select()
      .single();

    if (error) throw error;

    recordActivity({
      userId: user.id,
      type: 'contact_added',
      description: `${body.firstName} ${body.lastName} from ${body.company}`,
      contactId: contact.id,
      metadata: { contactName: `${body.firstName} ${body.lastName}`, company: body.company },
    })

    return NextResponse.json(
      { success: true, contact, message: 'Contact created successfully' },
      { status: 201, headers: { 'X-Trigger-Refresh': 'contacts,stats' } }
    );

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'Failed to create contact', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
