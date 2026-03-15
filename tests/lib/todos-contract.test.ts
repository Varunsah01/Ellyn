import {
  normalizeTodoText,
  normalizeTodoTimestamp,
  sanitizeTodoItems,
  TODO_CONTRACT,
} from '@/lib/todos'

describe('todos contract', () => {
  it('normalizes invalid timestamps to now-like ISO values', () => {
    const before = Date.now()
    const normalized = sanitizeTodoItems([
      {
        id: 'a',
        text: 'Task',
        completed: false,
        created_at: 'not-a-date',
        updated_at: '',
      },
    ])

    expect(normalized).toHaveLength(1)
    const createdAtMs = Date.parse(normalized[0].created_at)
    const updatedAtMs = Date.parse(normalized[0].updated_at)

    expect(Number.isFinite(createdAtMs)).toBe(true)
    expect(Number.isFinite(updatedAtMs)).toBe(true)
    expect(createdAtMs).toBeGreaterThanOrEqual(before - 5000)
    expect(updatedAtMs).toBeGreaterThanOrEqual(before - 5000)
  })

  it('deduplicates duplicate ids and keeps the last occurrence', () => {
    const normalized = sanitizeTodoItems([
      {
        id: 'dup',
        text: 'first',
        completed: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'dup',
        text: 'second',
        completed: true,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ])

    expect(normalized).toEqual([
      {
        id: 'dup',
        text: 'second',
        completed: true,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('trims and collapses text whitespace to the contract max length', () => {
    const raw = `   ${'a'.repeat(TODO_CONTRACT.maxTextLength + 20)}   `
    const normalizedText = normalizeTodoText(raw)

    expect(normalizedText.length).toBe(TODO_CONTRACT.maxTextLength)
    expect(normalizedText).toBe('a'.repeat(TODO_CONTRACT.maxTextLength))
  })

  it('caps completed items to the contract limit after sorting by updated_at', () => {
    const normalized = sanitizeTodoItems([
      { id: 'c1', text: 'Done 1', completed: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      { id: 'c2', text: 'Done 2', completed: true, created_at: '2026-01-02T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' },
      { id: 'c3', text: 'Done 3', completed: true, created_at: '2026-01-03T00:00:00.000Z', updated_at: '2026-01-03T00:00:00.000Z' },
      { id: 'a1', text: 'Active', completed: false, created_at: '2026-01-04T00:00:00.000Z', updated_at: '2026-01-04T00:00:00.000Z' },
    ])

    const completed = normalized.filter((item) => item.completed)
    expect(completed).toHaveLength(TODO_CONTRACT.maxCompletedItems)
    expect(completed.map((item) => item.id)).toEqual(['c3', 'c2'])
  })

  it('normalizes timestamp helper when input is valid ISO', () => {
    expect(normalizeTodoTimestamp('2026-02-01T12:00:00.000Z')).toBe('2026-02-01T12:00:00.000Z')
  })
})
