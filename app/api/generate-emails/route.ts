import { NextRequest, NextResponse } from 'next/server';
import { generateEmailPatterns, guessDomain } from '@/lib/email-patterns';
import { supabase } from '@/lib/supabase';

interface GenerateEmailsRequest {
  firstName: string;
  lastName: string;
  companyName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateEmailsRequest = await request.json();
    const { firstName, lastName, companyName } = body;

    // Validate inputs
    if (!firstName || !lastName || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, and companyName are required' },
        { status: 400 }
      );
    }

    // Validate minimum length
    if (firstName.trim().length < 2) {
      return NextResponse.json(
        { error: 'First name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (lastName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Last name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (companyName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Company name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Check domain cache first
    let domain = guessDomain(companyName);
    let fromCache = false;

    try {
      const { data: cachedDomain, error: cacheError } = await supabase
        .from('domain_cache')
        .select('domain, last_verified')
        .eq('company_name', companyName.trim().toLowerCase())
        .single();

      // Use cached domain if it exists and was verified within 7 days
      if (cachedDomain && !cacheError) {
        const lastVerified = new Date(cachedDomain.last_verified);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (lastVerified > sevenDaysAgo) {
          domain = cachedDomain.domain;
          fromCache = true;
          console.log(`Using cached domain for ${companyName}: ${domain}`);
        }
      }
    } catch (cacheError) {
      console.warn('Cache lookup failed, will generate domain:', cacheError);
    }

    // Generate domain if not found in cache or expired
    if (!fromCache) {

      // Save to cache (fire and forget)
      try {
        await supabase
          .from('domain_cache')
          .upsert({
            company_name: companyName.trim().toLowerCase(),
            domain,
            last_verified: new Date().toISOString(),
          }, {
            onConflict: 'company_name'
          });
        console.log(`Cached domain for ${companyName}: ${domain}`);
      } catch (cacheWriteError) {
        console.warn('Failed to write to cache:', cacheWriteError);
        // Don't fail the request if cache write fails
      }
    }

    // Generate all email patterns
    const emails = generateEmailPatterns(firstName, lastName, domain);

    // Return results
    return NextResponse.json({
      success: true,
      domain,
      fromCache,
      emails: emails.map(e => ({
        email: e.email,
        pattern: e.pattern,
        confidence: e.baseConfidence
      })),
      message: `Generated ${emails.length} email possibilities${fromCache ? ' (domain from cache)' : ''}`,
      metadata: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim()
      }
    });

  } catch (error) {
    console.error('Error generating emails:', error);
    return NextResponse.json(
      { error: 'Internal server error while generating email patterns' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate email patterns.' },
    { status: 405 }
  );
}
