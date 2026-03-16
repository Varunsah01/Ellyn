import { createServiceRoleClient } from '@/lib/supabase/server'

import { WebhookEventsTable } from './WebhookEventsTable'

type RawRow = Record<string, unknown>

type EventStatus = 'success' | 'failed' | 'pending'

type WebhookEventRow = {
  id: string
  source: 'dodo_webhook_events' | 'integration_logs'
  eventType: string
  userId: string | null
  status: EventStatus
  createdAt: string | null
  payload: Record<string, unknown>
  rawEvent: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function inferStatusFromText(value: string | null): EventStatus | null {
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized.includes('fail') || normalized.includes('error')) return 'failed'
  if (normalized.includes('pending') || normalized.includes('hold') || normalized.includes('queue')) return 'pending'
  if (normalized.includes('success') || normalized.includes('processed') || normalized.includes('active')) return 'success'

  return null
}

function inferEventStatus(row: RawRow, payload: Record<string, unknown>): EventStatus {
  const candidates = [
    asString(row.status),
    asString(row.level),
    asString(row.result),
    asString(payload.status),
    asString(payload.type),
    asString(row.event_type),
  ]

  for (const candidate of candidates) {
    const inferred = inferStatusFromText(candidate)
    if (inferred) return inferred
  }

  if (typeof row.error === 'string' && row.error.trim()) return 'failed'
  if (row.processed === false) return 'pending'

  return 'success'
}

function mapDodoEvent(row: RawRow): WebhookEventRow {
  const rawPayload = asRecord(row.raw_payload)
  const nestedPayload = asRecord(rawPayload.data)

  return {
    id: asString(row.id) ?? crypto.randomUUID(),
    source: 'dodo_webhook_events',
    eventType: asString(row.event_type) ?? asString(rawPayload.type) ?? 'unknown',
    userId: asString(row.user_id) ?? asString(nestedPayload.user_id) ?? null,
    status: inferEventStatus(row, rawPayload),
    createdAt: asString(row.created_at) ?? asString(row.processed_at) ?? null,
    payload: rawPayload,
    rawEvent: row,
  }
}

function mapIntegrationLog(row: RawRow): WebhookEventRow {
  const payload = asRecord(row.payload)

  return {
    id: asString(row.id) ?? crypto.randomUUID(),
    source: 'integration_logs',
    eventType: asString(row.event_type) ?? asString(row.event) ?? asString(row.action) ?? 'integration.event',
    userId: asString(row.user_id),
    status: inferEventStatus(row, payload),
    createdAt: asString(row.created_at),
    payload,
    rawEvent: row,
  }
}

export default async function WebhooksDashboardPage() {
  const supabase = await createServiceRoleClient()

  const [{ data: dodoRows, error: dodoError }, { data: integrationRows, error: integrationError }] = await Promise.all([
    supabase
      .from('dodo_webhook_events')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(200),
    supabase
      .from('integration_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const tableMissingError = integrationError?.code === '42P01'

  const events: WebhookEventRow[] = [
    ...((dodoRows ?? []) as RawRow[]).map(mapDodoEvent),
    ...((integrationRows ?? []) as RawRow[]).map(mapIntegrationLog),
  ].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Webhook &amp; Event Log Viewer</h1>
        <p className="text-sm text-gray-400 mt-1">Monitor billing and integration health in real-time.</p>
      </div>

      {(dodoError || (integrationError && !tableMissingError)) ? (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-5 mb-4">
          <p className="text-red-400 text-sm">
            Failed to load event data.
            {dodoError?.message ? ` dodo_webhook_events: ${dodoError.message}` : ''}
            {integrationError?.message ? ` integration_logs: ${integrationError.message}` : ''}
          </p>
        </div>
      ) : null}

      {tableMissingError ? (
        <div className="bg-amber-950/40 border border-amber-900 rounded-xl p-5 mb-4">
          <p className="text-amber-300 text-sm">
            integration_logs table is not available yet. Showing dodo_webhook_events only.
          </p>
        </div>
      ) : null}

      <WebhookEventsTable events={events} />
    </div>
  )
}
