export interface ContactRow {
  id: string
  user_id: string
  first_name: string
  last_name: string
  company: string
  role?: string | null
  inferred_email?: string | null
  confirmed_email?: string | null
  email_confidence?: number | null
  status?: 'new' | 'contacted' | 'replied' | 'no_response'
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface LeadRow {
  id: string
  user_id: string
  person_name: string
  company_name: string
  discovered_emails: Array<{ email: string; pattern?: string; confidence?: number }>
  selected_email?: string | null
  status?: 'discovered' | 'sent' | 'bounced' | 'replied'
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface OutreachRow {
  id: string
  user_id: string
  contact_id: string
  status: string
  updated_at?: string
  created_at?: string
  [key: string]: unknown
}

export interface TestDatabase {
  contacts: ContactRow[]
  leads: LeadRow[]
  outreach: OutreachRow[]
}

export const testDb: TestDatabase = {
  contacts: [],
  leads: [],
  outreach: [],
}

let idCounter = 1

export function nextId(prefix: string): string {
  const id = `${prefix}-${idCounter}`
  idCounter += 1
  return id
}

function cloneRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...(row as Record<string, unknown>) } as T))
}

/**
 * Resets the in-memory integration database between tests.
 */
export function resetTestDatabase(): void {
  testDb.contacts = []
  testDb.leads = []
  testDb.outreach = []
  idCounter = 1
}

/**
 * Seeds contacts/leads/outreach fixtures for integration tests.
 */
export function seedTestDatabase(seed: Partial<TestDatabase>): void {
  if (seed.contacts) {
    testDb.contacts = cloneRows(seed.contacts)
  }

  if (seed.leads) {
    testDb.leads = cloneRows(seed.leads)
  }

  if (seed.outreach) {
    testDb.outreach = cloneRows(seed.outreach)
  }
}

