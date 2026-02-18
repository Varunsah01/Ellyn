import { createServiceRoleClient } from '@/lib/supabase/server'

interface RecordActivityParams {
  userId: string
  type: string
  description: string
  contactId?: string | null
  metadata?: Record<string, unknown>
}

async function insertActivity(params: RecordActivityParams): Promise<void> {
  const supabase = await createServiceRoleClient()
  await supabase.from('activity_log').insert({
    user_id: params.userId,
    type: params.type,
    description: params.description,
    contact_id: params.contactId ?? null,
    metadata: params.metadata ?? {},
  })
}

export function recordActivity(params: RecordActivityParams): void {
  void insertActivity(params).catch((err) =>
    console.error('[recordActivity] Failed:', err)
  )
}
