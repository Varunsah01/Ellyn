/**
 * AI Settings API
 *
 * GET /api/ai/settings - Get user AI settings
 * PUT /api/ai/settings - Update user AI settings
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ai/settings
 * Get user AI settings
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

    // Get user settings
    let { data: settings, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Create default settings if not exists
    if (error && error.code === 'PGRST116') { // Not found
      const { data: newSettings, error: insertError } = await supabase
        .from('user_ai_settings')
        .insert({
          user_id: user.id,
          ai_enabled: true,
          daily_ai_limit: 50,
          anthropic_api_key: null
        })
        .select()
        .single();

      if (insertError) {
        console.error('[AI Settings] Error creating settings:', insertError);
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        );
      }

      settings = newSettings;
    } else if (error) {
      console.error('[AI Settings] Error fetching settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    // Mask API key if present
    const response = {
      ...settings,
      anthropic_api_key: settings.anthropic_api_key ? '***masked***' : null,
      has_api_key: !!settings.anthropic_api_key
    };

    delete response.anthropic_api_key; // Don't send the actual key

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('[AI Settings] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/settings
 * Update user AI settings
 *
 * Body:
 * {
 *   ai_enabled?: boolean,
 *   daily_ai_limit?: number,
 *   anthropic_api_key?: string
 * }
 */
export async function PUT(request: NextRequest) {
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
    const { ai_enabled, daily_ai_limit, anthropic_api_key } = body;

    // Validate inputs
    const updates: any = {};

    if (typeof ai_enabled === 'boolean') {
      updates.ai_enabled = ai_enabled;
    }

    if (typeof daily_ai_limit === 'number') {
      if (daily_ai_limit < 0 || daily_ai_limit > 1000) {
        return NextResponse.json(
          { error: 'daily_ai_limit must be between 0 and 1000' },
          { status: 400 }
        );
      }
      updates.daily_ai_limit = daily_ai_limit;
    }

    if (typeof anthropic_api_key === 'string') {
      // Validate API key format
      if (anthropic_api_key && !anthropic_api_key.startsWith('sk-ant-')) {
        return NextResponse.json(
          { error: 'Invalid API key format. Must start with sk-ant-' },
          { status: 400 }
        );
      }
      updates.anthropic_api_key = anthropic_api_key || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Update settings (upsert)
    const { data, error } = await supabase
      .from('user_ai_settings')
      .upsert({
        user_id: user.id,
        ...updates
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[AI Settings] Error updating settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    // Mask API key in response
    const response = {
      ...data,
      has_api_key: !!data.anthropic_api_key
    };

    delete response.anthropic_api_key; // Don't send the actual key

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('[AI Settings] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/settings
 * Delete user's API key (for security)
 */
export async function DELETE(request: NextRequest) {
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

    // Remove API key only
    const { error } = await supabase
      .from('user_ai_settings')
      .update({ anthropic_api_key: null })
      .eq('user_id', user.id);

    if (error) {
      console.error('[AI Settings] Error deleting API key:', error);
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully'
    });

  } catch (error) {
    console.error('[AI Settings] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
