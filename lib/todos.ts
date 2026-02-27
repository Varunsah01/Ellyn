export interface TodoItem {
  id: string
  text: string
  completed: boolean
  created_at: string
  updated_at: string
}

const MAX_TODO_ITEMS = 30
const MAX_TEXT_LENGTH = 180
const MAX_COMPLETED_ITEMS = 2

function toIsoOrNow(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return new Date().toISOString()
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

function toMillis(value: string): number {
  const parsed = new Date(value)
  const ms = parsed.getTime()
  return Number.isFinite(ms) ? ms : 0
}

function normalizeTodoItem(value: unknown): TodoItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id.trim().slice(0, 80) : ''
  const text = typeof row.text === 'string' ? row.text.trim().slice(0, MAX_TEXT_LENGTH) : ''
  if (!id || !text) return null

  const createdAt = toIsoOrNow(row.created_at)
  const updatedAt = toIsoOrNow(row.updated_at)

  return {
    id,
    text,
    completed: Boolean(row.completed),
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

export function sanitizeTodoItems(rawItems: unknown): TodoItem[] {
  const source = Array.isArray(rawItems) ? rawItems : []
  const deduped = new Map<string, TodoItem>()

  for (const raw of source) {
    const normalized = normalizeTodoItem(raw)
    if (!normalized) continue
    deduped.set(normalized.id, normalized)
  }

  const items = Array.from(deduped.values()).sort(
    (a, b) => toMillis(b.updated_at) - toMillis(a.updated_at)
  )

  const active = items.filter((item) => !item.completed)
  const completed = items
    .filter((item) => item.completed)
    .slice(0, MAX_COMPLETED_ITEMS)

  return [...active, ...completed].slice(0, MAX_TODO_ITEMS)
}

export function makeTodoItem(text: string): TodoItem {
  const now = new Date().toISOString()
  return {
    id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    text: text.trim().slice(0, MAX_TEXT_LENGTH),
    completed: false,
    created_at: now,
    updated_at: now,
  }
}

export function toggleTodoItem(items: TodoItem[], id: string): TodoItem[] {
  const now = new Date().toISOString()
  return sanitizeTodoItems(
    items.map((item) =>
      item.id === id
        ? {
            ...item,
            completed: !item.completed,
            updated_at: now,
          }
        : item
    )
  )
}

