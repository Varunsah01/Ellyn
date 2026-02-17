/** @jest-environment node */

import { NextRequest } from 'next/server'

import { DELETE as deleteLead, GET as getLeadById, PATCH as patchLead } from '@/app/api/leads/[id]/route'
import { GET as listLeads, POST as createLead } from '@/app/api/leads/route'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { resetTestDatabase, seedTestDatabase, testDb } from './helpers/test-db'

jest.mock('@/lib/supabase', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabaseMock } = require('./helpers/supabase-mock')
  return {
    isSupabaseConfigured: true,
    supabase: supabaseMock,
  }
})

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUser: jest.fn(),
}))

const getAuthenticatedUserMock = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>

describe('Leads integration management', () => {
  beforeEach(() => {
    resetTestDatabase()
    seedTestDatabase({
      leads: [
        {
          id: 'lead-1',
          user_id: 'user-1',
          person_name: 'Alice Example',
          company_name: 'Acme',
          discovered_emails: [{ email: 'alice@example.com', pattern: 'first', confidence: 70 }],
          selected_email: 'alice@example.com',
          status: 'discovered',
          created_at: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'lead-2',
          user_id: 'user-1',
          person_name: 'Bob Example',
          company_name: 'Beta',
          discovered_emails: [{ email: 'bob@example.com', pattern: 'first', confidence: 60 }],
          selected_email: null,
          status: 'sent',
          created_at: '2026-01-02T10:00:00.000Z',
        },
        {
          id: 'lead-3',
          user_id: 'user-2',
          person_name: 'Charlie Other',
          company_name: 'Gamma',
          discovered_emails: [{ email: 'charlie@example.com', pattern: 'first', confidence: 55 }],
          selected_email: null,
          status: 'discovered',
          created_at: '2026-01-03T10:00:00.000Z',
        },
      ],
    })

    getAuthenticatedUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)
  })

  afterEach(() => {
    resetTestDatabase()
    jest.clearAllMocks()
  })

  test('GET /api/leads returns only authenticated user leads', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads?page=1&limit=20')
    const response = await listLeads(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.leads).toHaveLength(2)
    expect(payload.leads.every((lead: Record<string, unknown>) => lead.user_id === 'user-1')).toBe(true)
  })

  test('GET /api/leads applies status and search filters', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads?status=sent&search=Bob')
    const response = await listLeads(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.leads).toHaveLength(1)
    expect(payload.leads[0].person_name).toBe('Bob Example')
    expect(payload.leads[0].status).toBe('sent')
  })

  test('GET /api/leads returns 401 for unauthorized access', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/leads')
    const response = await listLeads(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('POST /api/leads creates a new lead', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: 'Dana Candidate',
        companyName: 'Delta',
        emails: [{ email: 'dana@delta.com', pattern: 'first.last', confidence: 85 }],
        selectedEmail: 'dana@delta.com',
      }),
    })

    const response = await createLead(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.success).toBe(true)
    expect(payload.lead.user_id).toBe('user-1')
    expect(testDb.leads.some((lead) => lead.person_name === 'Dana Candidate')).toBe(true)
  })

  test('POST /api/leads returns 400 when validation fails', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: 'No Emails',
        companyName: 'Delta',
        emails: [],
      }),
    })

    const response = await createLead(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Validation failed')
  })

  test('PATCH /api/leads/[id] returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/lead-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await patchLead(request, { params: { id: 'lead-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Validation failed')
  })

  test('PATCH /api/leads/[id] updates lead status', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/lead-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'sent',
        selectedEmail: 'alice@example.com',
      }),
    })

    const response = await patchLead(request, { params: { id: 'lead-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(testDb.leads.find((lead) => lead.id === 'lead-1')?.status).toBe('sent')
  })

  test('PATCH /api/leads/[id] returns 404 for missing lead', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'sent',
      }),
    })

    const response = await patchLead(request, { params: { id: 'missing' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toMatch(/lead not found/i)
  })

  test('PATCH /api/leads/[id] returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/leads/lead-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'sent',
      }),
    })

    const response = await patchLead(request, { params: { id: 'lead-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('GET /api/leads/[id] returns one lead for authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/lead-1', {
      method: 'GET',
    })

    const response = await getLeadById(request, { params: { id: 'lead-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.lead.id).toBe('lead-1')
    expect(payload.lead.user_id).toBe('user-1')
  })

  test('GET /api/leads/[id] returns 404 for missing lead', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/missing', {
      method: 'GET',
    })

    const response = await getLeadById(request, { params: { id: 'missing' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toMatch(/lead not found/i)
  })

  test('DELETE /api/leads/[id] deletes lead', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/lead-2', {
      method: 'DELETE',
    })

    const response = await deleteLead(request, { params: { id: 'lead-2' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(testDb.leads.find((lead) => lead.id === 'lead-2')).toBeUndefined()
  })

  test('DELETE /api/leads/[id] is idempotent for missing lead', async () => {
    const request = new NextRequest('http://localhost:3000/api/leads/missing', {
      method: 'DELETE',
    })

    const response = await deleteLead(request, { params: { id: 'missing' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
  })

  test('DELETE /api/leads/[id] returns 401 for unauthorized access', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/leads/lead-2', {
      method: 'DELETE',
    })

    const response = await deleteLead(request, { params: { id: 'lead-2' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })
})
