import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { recordActivity } from '@/lib/utils/recordActivity'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = (await request.json()) as {
      type: string
      description: string
      contactId?: string | null
      metadata?: Record<string, unknown>
    }

    recordActivity({
      userId: user.id,
      type: body.type,
      description: body.description,
      contactId: body.contactId ?? null,
      metadata: body.metadata ?? {},
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Log activity error:', error)
    captureApiException(error, { route: '/api/activity', method: 'POST' })
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 })
  }
}
