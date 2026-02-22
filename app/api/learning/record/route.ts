import { NextRequest, NextResponse } from 'next/server';
import { invalidateEmailPatternCache } from '@/lib/cache/tags'
import { recordPatternFeedback } from '@/lib/learning-system';
import { LearningRecordSchema, formatZodError } from '@/lib/validation/schemas';
import { captureApiException } from '@/lib/monitoring/sentry'

/**
 * Handle POST requests for `/api/learning/record`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/learning/record request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/learning/record
 * fetch('/api/learning/record', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = LearningRecordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { domain, pattern, worked } = parsed.data;

    // Record feedback
    await recordPatternFeedback(domain, pattern, worked);
    try {
      await invalidateEmailPatternCache(domain)
    } catch (invalidateError) {
      console.warn('[Learning API] Pattern cache invalidation failed:', invalidateError)
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded. Thank you for helping improve our accuracy!',
      data: {
        domain,
        pattern,
        worked
      }
    });

  } catch (error) {
    console.error('[Learning API] Error:', error);
    captureApiException(error, { route: '/api/learning/record', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to record feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
