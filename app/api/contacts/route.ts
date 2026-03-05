import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers';
import { captureApiException } from '@/lib/monitoring/sentry'
import {
  createClient as createServerSupabaseClient,
  createServiceRoleClient,
} from '@/lib/supabase/server';
import { ContactCreateSchema, formatZodError } from '@/lib/validation/schemas';
import { recordActivity } from '@/lib/utils/recordActivity';

type ContactDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get('authorization');
  if (!rawAuth) return null;

  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function createRequestScopedSupabaseClient(
  request: Pick<Request, 'headers'>
): Promise<ContactDbClient> {
  const token = extractBearerToken(request.headers);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (token && supabaseUrl && supabaseAnonKey) {
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }) as unknown as ContactDbClient;
  }

  return createServerSupabaseClient();
}

const CONTACT_STATUS_VALUES = ['new', 'contacted', 'replied', 'no_response'] as const;
const CONTACT_SOURCE_VALUES = ['manual', 'extension', 'csv_import'] as const;
const CONTACT_SORT_FIELDS = [
  'created_at',
  'last_contacted_at',
  'company',
  'email_confidence',
] as const;
type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

function sanitizeSearch(value: string): string {
  return value
    .trim()
    .slice(0, 100)
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseCsvFilter(raw: string | null, allowed: readonly string[]): string[] {
  if (!raw) return [];
  const allowSet = new Set(allowed);
  const normalized = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && allowSet.has(item));
  return Array.from(new Set(normalized));
}

function parseTagsFilter(raw: string | null): string[] {
  if (!raw) return [];
  const tags = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 20);
  return Array.from(new Set(tags)).slice(0, 10);
}

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseHasEmail(raw: string | null): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function parseConfidence(raw: string | null): 'high' | 'medium' | 'low' | undefined {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return undefined;
}

function parseSortBy(raw: string | null): ContactSortField {
  if (!raw) return 'created_at';
  return CONTACT_SORT_FIELDS.includes(raw as ContactSortField)
    ? (raw as ContactSortField)
    : 'created_at';
}

function parseSortDirection(raw: string | null): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc';
}

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
    const supabase = await createServiceRoleClient();

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const search = sanitizeSearch(searchParams.get('search') || '');
    const status = parseCsvFilter(searchParams.get('status'), CONTACT_STATUS_VALUES);
    const tags = parseTagsFilter(searchParams.get('tags'));
    const hasEmail = parseHasEmail(searchParams.get('hasEmail'));
    const confidence = parseConfidence(searchParams.get('confidence'));
    const source = parseCsvFilter(searchParams.get('source'), CONTACT_SOURCE_VALUES);
    const sortBy = parseSortBy(searchParams.get('sortBy'));
    const sortDir = parseSortDirection(searchParams.get('sortDir'));
    const since = (searchParams.get('since') || '').trim().toLowerCase();
    const page = parsePositiveInt(searchParams.get('page'), 1, 1, 1000000);
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 1, 100);
    const includeOutreach = searchParams.get('includeOutreach') !== 'false';
    const rangeStart = (page - 1) * limit;
    const rangeEnd = page * limit - 1;

    const buildQuery = (includeLeadScoreCache: boolean) => {
      let query: any = (supabase as any)
        .from('contacts')
        .select(includeLeadScoreCache ? '*, lead_score_cache' : '*', { count: 'exact' })
        .eq('user_id', user.id);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,role.ilike.%${search}%`
        );
      }

      if (status.length > 0) {
        query = query.in('status', status);
      }

      if (tags.length > 0) {
        query = query.contains('tags', tags);
      }

      if (hasEmail === true) {
        query = query.not('inferred_email', 'is', null);
      } else if (hasEmail === false) {
        query = query.is('inferred_email', null);
      }

      if (confidence === 'high') {
        query = query.gte('email_confidence', 80);
      } else if (confidence === 'medium') {
        query = query.gte('email_confidence', 50).lt('email_confidence', 80);
      } else if (confidence === 'low') {
        query = query.lt('email_confidence', 50);
      }

      if (source.length > 0) {
        query = query.in('source', source);
      }

      if (since === '24h') {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', cutoff);
      }

      return query
        .order(sortBy, { ascending: sortDir === 'asc' })
        .range(rangeStart, rangeEnd);
    };

    let { data: contacts, error, count } = await buildQuery(true);

    if (
      error &&
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('lead_score_cache')
    ) {
      const fallback = await buildQuery(false);
      contacts = fallback.data;
      error = fallback.error;
      count = fallback.count;
    }

    if (error) throw error;

    let contactsWithOutreach: Array<Record<string, unknown>> = (contacts || []) as Array<
      Record<string, unknown>
    >;

    if (includeOutreach && contactsWithOutreach.length > 0) {
      const contactIds = contactsWithOutreach
        .map((contact) => String(contact.id ?? ''))
        .filter(Boolean);

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
            outreach_status: latestStatusByContact.get(String(contact.id ?? '')) || null,
          }));
        }
      }
    }

    const total = count || 0;
    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      contacts: contactsWithOutreach,
      total,
      page,
      pages,
      totalCount: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: pages,
      },
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get contacts error:', error);
    captureApiException(error, { route: '/api/contacts', method: 'GET' })
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
    const supabase = await createRequestScopedSupabaseClient(request);

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
      { status: 201, headers: { 'X-Trigger-Refresh': 'contacts,analytics' } }
    );

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create contact error:', error);
    captureApiException(error, { route: '/api/contacts', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to create contact', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
