import { nextId, testDb } from './test-db'

type Row = Record<string, unknown>
type TableName = keyof typeof testDb

type QueryResult = {
  data: unknown
  error: null | { code?: string; message: string }
  count?: number | null
}

interface OrderInstruction {
  field: string
  ascending: boolean
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private readonly table: TableName

  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'

  private selectWantsCount = false

  private selectInvoked = false

  private singleInvoked = false

  private maybeSingleInvoked = false

  private eqFilters: Array<{ field: string; value: unknown }> = []

  private inFilters: Array<{ field: string; values: unknown[] }> = []

  private searchValue: string | null = null

  private orders: OrderInstruction[] = []

  private rangeWindow: { from: number; to: number } | null = null

  private insertPayload: Row[] = []

  private updatePayload: Row = {}

  constructor(table: TableName) {
    this.table = table
  }

  select(_columns: string = '*', options?: { count?: 'exact' }): this {
    this.selectInvoked = true
    this.selectWantsCount = options?.count === 'exact'
    return this
  }

  eq(field: string, value: unknown): this {
    this.eqFilters.push({ field, value })
    return this
  }

  in(field: string, values: unknown[]): this {
    this.inFilters.push({ field, values })
    return this
  }

  or(expression: string): this {
    const match = expression.match(/%([^%]+)%/)
    this.searchValue = match?.[1]?.toLowerCase() || null
    return this
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orders.push({ field, ascending: options?.ascending ?? true })
    return this
  }

  range(from: number, to: number): this {
    this.rangeWindow = { from, to }
    return this
  }

  insert(payload: Row | Row[]): this {
    this.action = 'insert'
    this.insertPayload = Array.isArray(payload) ? payload : [payload]
    return this
  }

  update(payload: Row): this {
    this.action = 'update'
    this.updatePayload = payload
    return this
  }

  delete(): this {
    this.action = 'delete'
    return this
  }

  single(): Promise<QueryResult> {
    this.singleInvoked = true
    return this.execute()
  }

  maybeSingle(): Promise<QueryResult> {
    this.maybeSingleInvoked = true
    return this.execute()
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private execute(): Promise<QueryResult> {
    if (this.action === 'insert') {
      return Promise.resolve(this.executeInsert())
    }

    if (this.action === 'update') {
      return Promise.resolve(this.executeUpdate())
    }

    if (this.action === 'delete') {
      return Promise.resolve(this.executeDelete())
    }

    return Promise.resolve(this.executeSelect())
  }

  private executeSelect(): QueryResult {
    const allRows = this.getTableRows()
    const filtered = this.applyFilters(allRows)
    const totalCount = filtered.length
    const sorted = this.applyOrdering(filtered)
    const ranged = this.applyRange(sorted)

    if (this.singleInvoked) {
      const singleRow = ranged[0]
      if (!singleRow) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'Row not found' },
          count: null,
        }
      }

      return {
        data: { ...singleRow },
        error: null,
        count: this.selectWantsCount ? totalCount : null,
      }
    }

    if (this.maybeSingleInvoked) {
      const singleRow = ranged[0]
      return {
        data: singleRow ? { ...singleRow } : null,
        error: null,
        count: this.selectWantsCount ? totalCount : null,
      }
    }

    return {
      data: ranged.map((row) => ({ ...row })),
      error: null,
      count: this.selectWantsCount ? totalCount : null,
    }
  }

  private executeInsert(): QueryResult {
    const nowIso = new Date().toISOString()
    const rows = this.getTableRows()
    const inserted = this.insertPayload.map((entry) => ({
      id: String(entry.id || nextId(this.table)),
      created_at: entry.created_at || nowIso,
      updated_at: entry.updated_at || nowIso,
      ...entry,
    }))

    rows.push(...inserted)

    if (this.singleInvoked) {
      return { data: { ...inserted[0] }, error: null, count: null }
    }

    if (this.selectInvoked) {
      return { data: inserted.map((row) => ({ ...row })), error: null, count: null }
    }

    return { data: null, error: null, count: null }
  }

  private executeUpdate(): QueryResult {
    const rows = this.getTableRows()
    const matches = this.applyFilters(rows)

    if (matches.length === 0 && this.singleInvoked) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
        count: null,
      }
    }

    const nowIso = new Date().toISOString()
    for (const row of matches) {
      Object.assign(row, this.updatePayload, {
        updated_at: this.updatePayload.updated_at || nowIso,
      })
    }

    if (this.singleInvoked) {
      const row = matches[0]
      return { data: row ? { ...row } : null, error: null, count: null }
    }

    if (this.selectInvoked) {
      return {
        data: matches.map((row) => ({ ...row })),
        error: null,
        count: null,
      }
    }

    return { data: null, error: null, count: null }
  }

  private executeDelete(): QueryResult {
    const rows = this.getTableRows()
    const matches = this.applyFilters(rows)

    if (matches.length === 0) {
      return { data: null, error: null, count: null }
    }

    const idsToDelete = new Set(matches.map((row) => row.id))
    const remaining = rows.filter((row) => !idsToDelete.has(row.id))
    testDb[this.table] = remaining as never

    return { data: null, error: null, count: null }
  }

  private applyFilters(rows: Row[]): Row[] {
    let filtered = [...rows]

    for (const filter of this.eqFilters) {
      filtered = filtered.filter((row) => row[filter.field] === filter.value)
    }

    for (const filter of this.inFilters) {
      const lookup = new Set(filter.values)
      filtered = filtered.filter((row) => lookup.has(row[filter.field]))
    }

    if (this.searchValue) {
      const needle = this.searchValue
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          typeof value === 'string' ? value.toLowerCase().includes(needle) : false,
        ),
      )
    }

    return filtered
  }

  private applyOrdering(rows: Row[]): Row[] {
    if (this.orders.length === 0) return rows

    const sorted = [...rows]
    for (let index = this.orders.length - 1; index >= 0; index -= 1) {
      const order = this.orders[index]
      if (!order) continue
      sorted.sort((a, b) => {
        const aValue = a[order.field]
        const bValue = b[order.field]
        if (aValue === bValue) return 0

        if (aValue == null) return order.ascending ? -1 : 1
        if (bValue == null) return order.ascending ? 1 : -1

        if (aValue < bValue) return order.ascending ? -1 : 1
        return order.ascending ? 1 : -1
      })
    }

    return sorted
  }

  private applyRange(rows: Row[]): Row[] {
    if (!this.rangeWindow) return rows
    return rows.slice(this.rangeWindow.from, this.rangeWindow.to + 1)
  }

  private getTableRows(): Row[] {
    const rows = testDb[this.table]
    if (!rows) {
      throw new Error(`Unknown test table: ${this.table}`)
    }

    return rows as Row[]
  }
}

export const supabaseMock = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table as TableName)
  },
}
