import { NextRequest, NextResponse } from 'next/server';
import { invalidateEmailPatternCache } from '@/lib/cache/tags'
import { recordPatternFeedback, PatternFeedback } from '@/lib/pattern-learning';
import { PatternFeedbackSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry'

/**
 * Handle POST requests for `/api/pattern-feedback`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/pattern-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/pattern-feedback
 * fetch('/api/pattern-feedback', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = PatternFeedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { email, pattern, companyDomain, worked, contactId } = parsed.data;

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

    try {
      await invalidateEmailPatternCache(companyDomain)
    } catch (invalidateError) {
      console.warn('[pattern-feedback] Pattern cache invalidation failed:', invalidateError)
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
    captureApiException(error, { route: '/api/pattern-feedback', method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error while recording pattern feedback' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
/**
 * Handle GET requests for `/api/pattern-feedback`.
 * @returns {unknown} JSON response for the GET /api/pattern-feedback request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/pattern-feedback
 * fetch('/api/pattern-feedback')
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit pattern feedback.' },
    { status: 405 }
  );
}
