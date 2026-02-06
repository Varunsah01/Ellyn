import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { recordPatternFeedback } from '@/lib/learning-system';

export async function POST(request: NextRequest) {
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

    // Parse request
    const { domain, pattern, worked } = await request.json();

    if (!domain || !pattern || typeof worked !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: domain, pattern, worked (boolean)' },
        { status: 400 }
      );
    }

    // Record feedback
    await recordPatternFeedback(domain, pattern, worked);

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
    return NextResponse.json(
      { error: 'Failed to record feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
