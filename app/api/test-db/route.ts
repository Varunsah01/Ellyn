import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  // Keep this endpoint development-only to avoid exposing internal diagnostics.
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: {
        user_profiles_count: count ?? 0,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

