'use client'

import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/dashboard/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

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

function statusBadgeClass(status: EventStatus) {
  switch (status) {
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'failed':
      return 'border-red-500/40 bg-red-500/10 text-red-300'
    default:
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  }
}

function statusLabel(status: EventStatus) {
  if (status === 'success') return 'Success'
  if (status === 'failed') return 'Failed'
  return 'Pending'
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function shortJson(value: Record<string, unknown>) {
  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 120 ? `${serialized.slice(0, 120)}...` : serialized
  } catch {
    return '[unserializable payload]'
  }
}

export function WebhookEventsTable({ events }: { events: WebhookEventRow[] }) {
  const { toast } = useToast()
  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | EventStatus>('all')
  const [sourceFilter, setSourceFilter] = React.useState<'all' | WebhookEventRow['source']>('all')
  const [selectedEvent, setSelectedEvent] = React.useState<WebhookEventRow | null>(null)
  const [retryingEventId, setRetryingEventId] = React.useState<string | null>(null)

  const filteredEvents = React.useMemo(() => {
    const loweredQuery = query.trim().toLowerCase()

    return events.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) return false
      if (sourceFilter !== 'all' && event.source !== sourceFilter) return false

      if (!loweredQuery) return true

      const searchable = [
        event.eventType,
        event.userId ?? '',
        event.source,
        shortJson(event.payload),
      ]
        .join(' ')
        .toLowerCase()

      return searchable.includes(loweredQuery)
    })
  }, [events, query, sourceFilter, statusFilter])

  const handleRetryWebhook = React.useCallback(async (event: WebhookEventRow) => {
    setRetryingEventId(event.id)

    try {
      const response = await fetch('/api/v1/dodo/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event.payload ?? event.rawEvent ?? {}),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Retry failed (${response.status})`)
      }

      toast({
        title: 'Webhook retry sent',
        description: `${event.eventType} was submitted to /api/v1/dodo/webhook.`,
      })
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Unable to retry webhook event.',
        variant: 'destructive',
      })
    } finally {
      setRetryingEventId(null)
    }
  }, [toast])

  const columns = React.useMemo<ColumnDef<WebhookEventRow>[]>(() => [
    {
      accessorKey: 'eventType',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <p className="text-sm text-white font-medium">{row.original.eventType}</p>
          <p className="text-xs text-gray-500">{row.original.id}</p>
        </div>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <span className="text-xs text-gray-300">
          {row.original.source === 'dodo_webhook_events' ? 'Dodo Webhooks' : 'Integration Logs'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={cn('font-medium', statusBadgeClass(row.original.status))}>
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: 'userId',
      header: 'User',
      cell: ({ row }) => (
        <span className="text-xs text-gray-300 font-mono">
          {row.original.userId ? `${row.original.userId.slice(0, 8)}…` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Time',
      cell: ({ row }) => <span className="text-xs text-gray-300">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const event = row.original
        const isRetrying = retryingEventId === event.id

        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedEvent(event)
              }}
            >
              View Payload
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isRetrying}
              onClick={(e) => {
                e.stopPropagation()
                void handleRetryWebhook(event)
              }}
            >
              {isRetrying ? 'Retrying…' : 'Retry Webhook'}
            </Button>
          </div>
        )
      },
    },
  ], [handleRetryWebhook, retryingEventId])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          placeholder="Search by event, user ID, source, or payload..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="bg-gray-900 border-gray-800 text-sm text-gray-100"
        />

        <Select value={statusFilter} onValueChange={(value: 'all' | EventStatus) => setStatusFilter(value)}>
          <SelectTrigger className="bg-gray-900 border-gray-800 text-sm text-gray-100">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={(value: 'all' | WebhookEventRow['source']) => setSourceFilter(value)}>
          <SelectTrigger className="bg-gray-900 border-gray-800 text-sm text-gray-100">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="dodo_webhook_events">Dodo Webhooks</SelectItem>
            <SelectItem value="integration_logs">Integration Logs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <DataTable columns={columns} data={filteredEvents} />
      </div>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-2xl bg-gray-950 border-gray-800 text-gray-100">
          <SheetHeader>
            <SheetTitle className="text-white">Webhook Payload</SheetTitle>
            <SheetDescription>
              {selectedEvent ? `${selectedEvent.eventType} • ${selectedEvent.source}` : 'Inspect webhook JSON.'}
            </SheetDescription>
          </SheetHeader>

          {selectedEvent && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={cn('font-medium', statusBadgeClass(selectedEvent.status))}>
                  {statusLabel(selectedEvent.status)}
                </Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={retryingEventId === selectedEvent.id}
                  onClick={() => void handleRetryWebhook(selectedEvent)}
                >
                  {retryingEventId === selectedEvent.id ? 'Retrying…' : 'Retry Webhook'}
                </Button>
              </div>

              <pre className="text-xs leading-relaxed bg-black/40 border border-gray-800 rounded-lg p-3 overflow-auto max-h-[70vh]">
                {JSON.stringify(selectedEvent.rawEvent, null, 2)}
              </pre>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
