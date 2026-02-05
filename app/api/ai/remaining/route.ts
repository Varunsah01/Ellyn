/**
 * AI Remaining Generations API
 *
 * GET /api/ai/remaining - Get remaining AI generations for today
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ai/remaining
 * Get remaining AI generations for the authenticated user
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

    const today = new Date().toISOString().split('T')[0];

    // Get user settings
    let { data: settings } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Create default settings if not exists
    if (!settings) {
      const { data: newSettings, error: insertError } = await supabase
        .from('user_ai_settings')
        .insert({
          user_id: user.id,
          ai_enabled: true,
          daily_ai_limit: 50
        })
        .select()
        .single();

      if (insertError) {
        console.error('[AI Remaining] Error creating settings:', insertError);
        // Use defaults
        settings = {
          ai_enabled: true,
          daily_ai_limit: 50
        };
      } else {
        settings = newSettings;
      }
    }

    const dailyLimit = settings.daily_ai_limit || 50;
    const aiEnabled = settings.ai_enabled !== false;

    // Get today's usage
    const { data: todayUsage } = await supabase
      .from('ai_usage')
      .select('generation_count, tokens_used, estimated_cost')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    const used = todayUsage?.generation_count || 0;
    const remaining = Math.max(0, dailyLimit - used);

    // Calculate reset time (next midnight)
    const resetTime = new Date(today);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);

    // Calculate time until reset
    const now = new Date();
    const msUntilReset = resetTime.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    return NextResponse.json({
      success: true,
      data: {
        enabled: aiEnabled,
        dailyLimit,
        used,
        remaining,
        percentage: dailyLimit > 0 ? Math.round((used / dailyLimit) * 100) : 0,
        tokens: todayUsage?.tokens_used || 0,
        cost: parseFloat(todayUsage?.estimated_cost || '0').toFixed(4),
        resetTime: resetTime.toISOString(),
        timeUntilReset: {
          hours: hoursUntilReset,
          minutes: minutesUntilReset,
          formatted: `${hoursUntilReset}h ${minutesUntilReset}m`
        }
      }
    });

  } catch (error) {
    console.error('[AI Remaining] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
