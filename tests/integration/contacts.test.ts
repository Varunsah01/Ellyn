/** @jest-environment node */

import { NextRequest } from 'next/server'

import {
  DELETE as deleteContact,
  GET as getContactById,
  PATCH as patchContact,
  PUT as putContact,
} from '@/app/api/contacts/[id]/route'
import { GET as listContacts, POST as createContact } from '@/app/api/contacts/route'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { resetTestDatabase, seedTestDatabase, testDb } from './helpers/test-db'

jest.mock('@/lib/supabase/server', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabaseMock } = require('./helpers/supabase-mock')
  return {
    isSupabaseConfigured: true,
    createClient: jest.fn().mockResolvedValue(supabaseMock),
    createServiceRoleClient: jest.fn().mockReturnValue(supabaseMock),
    supabase: supabaseMock,
  }
})

jest.mock('@/lib/auth/helpers', () => ({
  getAuthenticatedUserFromRequest: jest.fn(),
}))

const getAuthenticatedUserFromRequestMock = getAuthenticatedUserFromRequest as jest.MockedFunction<typeof getAuthenticatedUserFromRequest>

describe('Contacts integration CRUD', () => {
  beforeEach(() => {
    resetTestDatabase()
    seedTestDatabase({
      contacts: [
        {
          id: 'contact-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme',
          status: 'new',
          created_at: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'contact-2',
          user_id: 'user-1',
          first_name: 'Jane',
          last_name: 'Roe',
          company: 'Beta',
          status: 'contacted',
          created_at: '2026-01-02T10:00:00.000Z',
        },
        {
          id: 'contact-3',
          user_id: 'user-2',
          first_name: 'Other',
          last_name: 'User',
          company: 'Gamma',
          status: 'new',
          created_at: '2026-01-03T10:00:00.000Z',
        },
      ],
      outreach: [
        {
          id: 'outreach-1',
          user_id: 'user-1',
          contact_id: 'contact-1',
          status: 'follow_up',
          created_at: '2026-01-03T10:00:00.000Z',
          updated_at: '2026-01-04T10:00:00.000Z',
        },
      ],
    })

    getAuthenticatedUserFromRequestMock.mockResolvedValue({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)
  })

  afterEach(() => {
    resetTestDatabase()
    jest.clearAllMocks()
  })

  test('GET /api/contacts returns only authenticated user contacts and outreach status', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts?page=1&limit=20')
    const response = await listContacts(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.contacts).toHaveLength(2)
    expect(payload.contacts.every((contact: Record<string, unknown>) => contact.user_id === 'user-1')).toBe(true)
    expect(payload.contacts.find((contact: Record<string, unknown>) => contact.id === 'contact-1').outreach_status).toBe(
      'follow_up',
    )
  })

  test('GET /api/contacts applies search and status filters', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts?search=Jane&status=contacted&includeOutreach=false')
    const response = await listContacts(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.contacts).toHaveLength(1)
    expect(payload.contacts[0].first_name).toBe('Jane')
    expect(payload.contacts[0].status).toBe('contacted')
    expect(payload.contacts[0]).not.toHaveProperty('outreach_status')
  })

  test('POST /api/contacts creates a new contact for authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'New',
        lastName: 'Contact',
        company: 'Delta',
        role: 'Engineer',
        status: 'new',
        source: 'manual',
      }),
    })

    const response = await createContact(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.success).toBe(true)
    expect(payload.contact.user_id).toBe('user-1')
    expect(testDb.contacts).toHaveLength(4)
    expect(testDb.contacts.some((contact) => contact.first_name === 'New')).toBe(true)
  })

  test('POST /api/contacts returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required firstName/lastName/company
        role: 'Engineer',
      }),
    })

    const response = await createContact(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Validation failed')
    expect(testDb.contacts).toHaveLength(3)
  })

  test('POST /api/contacts returns 401 when user is not authenticated', async () => {
    getAuthenticatedUserFromRequestMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'No',
        lastName: 'Auth',
        company: 'Acme',
      }),
    })

    const response = await createContact(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('GET /api/contacts/[id] returns one contact for the authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/contact-1')
    const response = await getContactById(request, { params: { id: 'contact-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.contact.id).toBe('contact-1')
    expect(payload.contact.user_id).toBe('user-1')
  })

  test('GET /api/contacts/[id] returns 404 when contact does not exist', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/missing')
    const response = await getContactById(request, { params: { id: 'missing' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toMatch(/contact not found/i)
  })

  test('GET /api/contacts/[id] returns 401 when user is not authenticated', async () => {
    getAuthenticatedUserFromRequestMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/contacts/contact-1')
    const response = await getContactById(request, { params: { id: 'contact-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('PATCH /api/contacts/[id] updates an existing contact', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/contact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'contacted',
      }),
    })

    const response = await patchContact(request, { params: { id: 'contact-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(testDb.contacts.find((contact) => contact.id === 'contact-1')?.status).toBe('contacted')
  })

  test('PATCH /api/contacts/[id] returns 400 when payload is empty', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/contact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await patchContact(request, { params: { id: 'contact-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Validation failed')
  })

  test('PUT /api/contacts/[id] updates fields for backward compatibility', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/contact-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Johnathan',
        status: 'replied',
      }),
    })

    const response = await putContact(request, { params: { id: 'contact-1' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(testDb.contacts.find((contact) => contact.id === 'contact-1')?.first_name).toBe('Johnathan')
    expect(testDb.contacts.find((contact) => contact.id === 'contact-1')?.status).toBe('replied')
  })

  test('DELETE /api/contacts/[id] removes the requested contact', async () => {
    const request = new NextRequest('http://localhost:3000/api/contacts/contact-2', {
      method: 'DELETE',
    })

    const response = await deleteContact(request, { params: { id: 'contact-2' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(testDb.contacts.find((contact) => contact.id === 'contact-2')).toBeUndefined()
  })

  test('DELETE /api/contacts/[id] returns 401 when user is not authenticated', async () => {
    getAuthenticatedUserFromRequestMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/contacts/contact-2', {
      method: 'DELETE',
    })

    const response = await deleteContact(request, { params: { id: 'contact-2' } } as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })
})
