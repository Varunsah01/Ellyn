import { NextRequest, NextResponse } from 'next/server';
import { recordPatternFeedback, PatternFeedback } from '@/lib/pattern-learning';

interface FeedbackRequest {
  email: string;
  pattern: string;
  companyDomain: string;
  worked: boolean;
  contactId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { email, pattern, companyDomain, worked, contactId } = body;

    // Validate inputs
    if (!email || !pattern || !companyDomain || typeof worked !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: email, pattern, companyDomain, and worked are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Record the feedback
    const feedback: PatternFeedback = {
      email,
      pattern,
      company_domain: companyDomain,
      worked,
      contact_id: contactId,
    };

    const result = await recordPatternFeedback(feedback);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to record pattern feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pattern feedback recorded: ${pattern} ${worked ? 'worked' : 'did not work'} for ${companyDomain}`,
      data: {
        email,
        pattern,
        companyDomain,
        worked,
      },
    });
  } catch (error) {
    console.error('Error recording pattern feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error while recording pattern feedback' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit pattern feedback.' },
    { status: 405 }
  );
}
