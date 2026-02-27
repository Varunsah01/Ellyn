import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sanitizeTodoItems, type TodoItem } from '@/lib/todos'

const METADATA_TODOS_KEY = 'ellyn_todos'

const TodoItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(180),
  completed: z.boolean(),
  created_at: z.string().trim().min(1).max(80),
  updated_at: z.string().trim().min(1).max(80),
})

const TodoUpdateSchema = z.object({
  items: z.array(TodoItemSchema).max(100),
})

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

async function readTodosForUser(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string
): Promise<TodoItem[]> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) throw error

  const userMetadata = asRecord(data.user?.user_metadata)
  return sanitizeTodoItems(userMetadata[METADATA_TODOS_KEY])
}

async function writeTodosForUser(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  items: TodoItem[]
) {
  const { data: existingUserData, error: existingUserError } = await supabase.auth.admin.getUserById(
    userId
  )
  if (existingUserError) throw existingUserError

  const existingMetadata = asRecord(existingUserData.user?.user_metadata)
  const nextMetadata = {
    ...existingMetadata,
    [METADATA_TODOS_KEY]: sanitizeTodoItems(items),
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: nextMetadata,
  })
  if (updateError) throw updateError
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()
    const items = await readTodosForUser(supabase, user.id)

    return NextResponse.json({
      success: true,
      items,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[todos GET] Failed:', error)
    captureApiException(error, { route: '/api/todos', method: 'GET' })
    return NextResponse.json({ error: 'Failed to load todos' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = TodoUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const sanitized = sanitizeTodoItems(parsed.data.items)
    await writeTodosForUser(supabase, user.id, sanitized)

    return NextResponse.json({
      success: true,
      items: sanitized,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[todos PUT] Failed:', error)
    captureApiException(error, { route: '/api/todos', method: 'PUT' })
    return NextResponse.json({ error: 'Failed to save todos' }, { status: 500 })
  }
}

