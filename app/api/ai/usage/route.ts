/**
 * AI Usage API Routes
 *
 * GET /api/ai/usage - Get usage statistics
 * POST /api/ai/usage - Track a generation
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ai/usage
 * Get AI usage statistics for the authenticated user
 *
 * Query params:
 * - period: 'today' | 'week' | 'month' | 'all' (default: 'today')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'today';

    // Get user settings
    const { data: settings } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const dailyLimit = settings?.daily_ai_limit || 50;

    // Calculate date range
    const today = new Date().toISOString().split('T')[0];
    let startDate = today;

    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split('T')[0];
    }

    // Get usage data
    let query = supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (period !== 'all') {
      query = query.gte('date', startDate);
    }

    const { data: usageData, error: usageError } = await query;

    if (usageError) {
      console.error('[AI Usage] Error fetching usage:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const todayUsage = usageData?.find(u => u.date === today);
    const used = todayUsage?.generation_count || 0;
    const remaining = Math.max(0, dailyLimit - used);

    const totalGenerations = usageData?.reduce((sum, u) => sum + u.generation_count, 0) || 0;
    const totalTokens = usageData?.reduce((sum, u) => sum + u.tokens_used, 0) || 0;
    const totalCost = usageData?.reduce((sum, u) => sum + parseFloat(u.estimated_cost), 0) || 0;

    // Calculate reset time (midnight)
    const resetTime = new Date(today);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);

    return NextResponse.json({
      success: true,
      data: {
        today: {
          used,
          remaining,
          dailyLimit,
          resetTime: resetTime.toISOString()
        },
        period: {
          type: period,
          totalGenerations,
          totalTokens,
          totalCost: totalCost.toFixed(4),
          records: usageData
        }
      }
    });

  } catch (error) {
    console.error('[AI Usage] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/usage
 * Track an AI generation
 *
 * Body:
 * {
 *   tokens: number,
 *   cost: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tokens = 0, cost = 0 } = body;

    if (typeof tokens !== 'number' || typeof cost !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request body. Expected {tokens: number, cost: number}' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Get user settings to check limit
    const { data: settings } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const dailyLimit = settings?.daily_ai_limit || 50;

    // Check if user has hit limit
    const { data: todayUsage } = await supabase
      .from('ai_usage')
      .select('generation_count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    const currentCount = todayUsage?.generation_count || 0;

    if (currentCount >= dailyLimit) {
      return NextResponse.json(
        {
          error: 'Daily limit reached',
          limit: dailyLimit,
          used: currentCount
        },
        { status: 429 }
      );
    }

    // Upsert usage record (increment if exists, create if not)
    const { data, error } = await supabase
      .from('ai_usage')
      .upsert({
        user_id: user.id,
        date: today,
        generation_count: (currentCount || 0) + 1,
        tokens_used: (todayUsage?.tokens_used || 0) + tokens,
        estimated_cost: (parseFloat(todayUsage?.estimated_cost || '0') + cost).toString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      console.error('[AI Usage] Error tracking usage:', error);
      return NextResponse.json(
        { error: 'Failed to track usage' },
        { status: 500 }
      );
    }

    // Calculate remaining
    const newCount = data.generation_count;
    const remaining = Math.max(0, dailyLimit - newCount);

    return NextResponse.json({
      success: true,
      data: {
        used: newCount,
        remaining,
        dailyLimit,
        tokens: data.tokens_used,
        cost: parseFloat(data.estimated_cost).toFixed(4)
      }
    });

  } catch (error) {
    console.error('[AI Usage] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
