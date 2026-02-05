import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail, checkMXRecords } from '@/lib/email-verification';

interface EmailToVerify {
  email: string;
  pattern: string;
  baseConfidence: number;
  confidence?: number;
}

interface VerifyEmailRequest {
  emails: EmailToVerify[];
  domain: string;
}

interface VerifiedEmail extends EmailToVerify {
  verified: boolean;
  smtpStatus: 'valid' | 'invalid' | 'unknown';
  confidence: number;
  verificationTime: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyEmailRequest = await request.json();
    const { emails, domain } = body;

    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'emails array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'domain is required' },
        { status: 400 }
      );
    }

    // Rate limiting: max 10 emails per request
    if (emails.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 emails can be verified per request' },
        { status: 400 }
      );
    }

    // Validate email structure
    for (const item of emails) {
      if (!item.email || !item.pattern || typeof item.baseConfidence !== 'number') {
        return NextResponse.json(
          { error: 'Each email must have email, pattern, and baseConfidence fields' },
          { status: 400 }
        );
      }
    }

    // Check MX records for the domain once
    console.log(`Checking MX records for domain: ${domain}`);
    const hasMX = await checkMXRecords(domain);
    console.log(`Domain ${domain} has MX records: ${hasMX}`);

    // Verify all emails in parallel
    const verificationPromises = emails.map(async (item) => {
      const startTime = Date.now();

      try {
        const result = await verifyEmail(
          item.email,
          domain,
          item.baseConfidence || item.confidence || 0
        );

        const verifiedEmail: VerifiedEmail = {
          ...item,
          verified: result.smtpStatus === 'valid',
          smtpStatus: result.smtpStatus,
          confidence: result.confidence,
          verificationTime: new Date().toISOString(),
        };

        if (result.error) {
          verifiedEmail.error = result.error;
        }

        console.log(
          `Verified ${item.email} in ${Date.now() - startTime}ms: ${result.smtpStatus} (${result.confidence}%)`
        );

        return verifiedEmail;
      } catch (error) {
        console.error(`Error verifying ${item.email}:`, error);
        return {
          ...item,
          verified: false,
          smtpStatus: 'unknown' as const,
          confidence: item.baseConfidence || item.confidence || 0,
          verificationTime: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Verification failed',
        };
      }
    });

    const verifiedEmails = await Promise.all(verificationPromises);

    // Sort by confidence (highest first)
    verifiedEmails.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      domain,
      hasMX,
      emails: verifiedEmails,
      verified: verifiedEmails.filter((e) => e.verified).length,
      total: verifiedEmails.length,
      message: `Verified ${verifiedEmails.length} email(s)`,
    });
  } catch (error) {
    console.error('Error in verify-email endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error during email verification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to verify emails.' },
    { status: 405 }
  );
}
