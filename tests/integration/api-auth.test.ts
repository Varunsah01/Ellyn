/** @jest-environment node */

import { NextRequest } from 'next/server'

import { GET as listContacts } from '@/app/api/contacts/route'
import { POST as createLead } from '@/app/api/leads/route'
import { GET as changePasswordGet, POST as changePassword } from '@/app/api/auth/change-password/route'
import { GET as signupGet, POST as signup } from '@/app/api/auth/signup/route'
import { GET as generateTemplateGet, POST as generateTemplate } from '@/app/api/ai/generate-template/route'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { resetTestDatabase } from './helpers/test-db'

const createServerClientMock = jest.fn()
const createSupabaseClientMock = jest.fn()
const getGeminiClientMock = jest.fn()
const checkAiRateLimitMock = jest.fn()
const getRateLimitIdentifierMock = jest.fn()
const signUpMock = jest.fn()
const updateUserMock = jest.fn()
const signInWithPasswordMock = jest.fn()
const generateTextMock = jest.fn()

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

jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createServerClientMock(...args),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createSupabaseClientMock(...args),
}))

jest.mock('@/lib/gemini', () => ({
  getGeminiClient: (...args: unknown[]) => getGeminiClientMock(...args),
}))

jest.mock('@/lib/ai-rate-limit', () => ({
  checkAiRateLimit: (...args: unknown[]) => checkAiRateLimitMock(...args),
  getRateLimitIdentifier: (...args: unknown[]) => getRateLimitIdentifierMock(...args),
}))

const getAuthenticatedUserMock = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>

describe('API authentication and external API mocking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetTestDatabase()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    createServerClientMock.mockResolvedValue({
      auth: {
        signUp: signUpMock,
        updateUser: updateUserMock,
      },
    })

    createSupabaseClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    })

    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: 'user-signup', email: 'new@example.com', user_metadata: {} } },
      error: null,
    })
    updateUserMock.mockResolvedValue({ error: null })
    signInWithPasswordMock.mockResolvedValue({ error: null })

    getRateLimitIdentifierMock.mockReturnValue('test-user')
    checkAiRateLimitMock.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        subject: 'Integration Subject',
        body: 'Integration Body',
      }),
      tokensUsed: { input: 10, output: 20, total: 30 },
      cost: 0.0001,
    })
    getGeminiClientMock.mockReturnValue({
      generateText: generateTextMock,
    })
  })

  test('returns 401 when contacts endpoint is requested without authentication', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/contacts')
    const response = await listContacts(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('returns 401 when lead creation is attempted without authentication', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: 'Auth Required',
        companyName: 'Acme',
        emails: [{ email: 'auth@acme.com' }],
      }),
    })

    const response = await createLead(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('signup endpoint rejects weak passwords before creating user', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak Password',
        email: 'weak@example.com',
        password: 'weakpass',
        emailRedirectTo: 'http://localhost:3000/auth/login',
      }),
    })

    const response = await signup(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/password does not meet strength requirements/i)
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  test('signup endpoint returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid',
        password: '',
      }),
    })

    const response = await signup(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/required|valid email|invalid input/i)
  })

  test('signup endpoint returns 400 when Supabase signup fails', async () => {
    signUpMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Email already registered' },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'StrongPass1!',
        emailRedirectTo: 'http://localhost:3000/auth/login',
      }),
    })

    const response = await signup(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/already registered/i)
  })

  test('signup endpoint returns success when session is created immediately', async () => {
    signUpMock.mockResolvedValueOnce({
      data: {
        session: { access_token: 'token' },
        user: { id: 'user-new', email: 'new@example.com', user_metadata: { full_name: 'New User' } },
      },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New User',
        email: 'new@example.com',
        password: 'StrongPass1!',
        emailRedirectTo: 'http://localhost:3000/auth/login',
      }),
    })

    const response = await signup(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.hasSession).toBe(true)
    expect(payload.user.email).toBe('new@example.com')
  })

  test('signup GET returns 405', async () => {
    const response = await signupGet()
    const payload = await response.json()

    expect(response.status).toBe(405)
    expect(payload.error).toMatch(/method not allowed/i)
  })

  test('change-password endpoint requires authentication', async () => {
    getAuthenticatedUserMock.mockRejectedValueOnce(new Error('Unauthorized'))

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'NewStrong1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  test('change-password endpoint returns 400 for weak new password', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'weakpass',
        confirmPassword: 'weakpass',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/password does not meet strength requirements/i)
  })

  test('change-password endpoint returns 400 for invalid request body', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPassword: 'StrongPass1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/required|invalid input/i)
  })

  test('change-password endpoint returns 400 for mismatched confirmation', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'Different1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/do not match/i)
  })

  test('change-password endpoint returns 400 when new password equals current password', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'SamePass1!',
        newPassword: 'SamePass1!',
        confirmPassword: 'SamePass1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/must be different/i)
  })

  test('change-password endpoint returns 400 when authenticated user has no email', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: null,
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'NewStrong1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/unable to verify current password/i)
  })

  test('change-password endpoint returns 400 when current password is wrong', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'WrongCurrent1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'NewStrong1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/current password is incorrect/i)
  })

  test('change-password endpoint returns 400 when update fails', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)
    updateUserMock.mockResolvedValueOnce({
      error: { message: 'Update failed' },
    })

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'NewStrong1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/unable to update password|update failed/i)
  })

  test('change-password endpoint updates password when request is valid', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user1@example.com',
    } as never)

    const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Current1!',
        newPassword: 'NewStrong1!',
        confirmPassword: 'NewStrong1!',
      }),
    })

    const response = await changePassword(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'NewStrong1!' })
  })

  test('change-password GET returns 405', async () => {
    const response = await changePasswordGet()
    const payload = await response.json()

    expect(response.status).toBe(405)
    expect(payload.error).toMatch(/method not allowed/i)
  })

  test('mocks Gemini client for AI template generation endpoint', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateType: 'recruiter',
        instructions: 'Keep it concise',
        context: {
          userName: 'Integration Tester',
        },
        targetRole: 'Engineer',
        targetCompany: 'Acme',
      }),
    })

    const response = await generateTemplate(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.template.subject).toBe('Integration Subject')
    expect(payload.template.body).toBe('Integration Body')
    expect(getGeminiClientMock).toHaveBeenCalled()
  })

  test('generate-template returns 429 when rate limited', async () => {
    checkAiRateLimitMock.mockReturnValueOnce({ allowed: false, retryAfterMs: 2_000 })

    const request = new NextRequest('http://localhost:3000/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateType: 'recruiter',
        instructions: 'Keep it concise',
        context: { userName: 'Integration Tester' },
      }),
    })

    const response = await generateTemplate(request)
    const payload = await response.json()

    expect(response.status).toBe(429)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/rate limit exceeded/i)
    expect(response.headers.get('Retry-After')).toBe('2')
  })

  test('generate-template returns 400 for invalid request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateType: 'recruiter',
      }),
    })

    const response = await generateTemplate(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/validation failed/i)
  })

  test('generate-template falls back to plain text parsing when model output is not JSON', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: 'Subject: Follow-up on application\nBody: Hi there,\nThanks for your time.',
      tokensUsed: { input: 11, output: 19, total: 30 },
      cost: 0.0002,
    })

    const request = new NextRequest('http://localhost:3000/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateType: 'follow-up',
        instructions: 'Polite and short',
        context: {
          userName: 'Integration Tester',
        },
      }),
    })

    const response = await generateTemplate(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.template.subject).toMatch(/follow-up on application/i)
    expect(payload.template.body).toMatch(/thanks for your time/i)
  })

  test('generate-template returns 500 when Gemini client throws', async () => {
    generateTextMock.mockRejectedValueOnce(new Error('Gemini unavailable'))

    const request = new NextRequest('http://localhost:3000/api/ai/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateType: 'recruiter',
        instructions: 'Keep it concise',
        context: {
          userName: 'Integration Tester',
        },
      }),
    })

    const response = await generateTemplate(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.success).toBe(false)
    expect(payload.error).toMatch(/gemini unavailable/i)
  })

  test('generate-template GET returns 405', async () => {
    const response = await generateTemplateGet()
    const payload = await response.json()

    expect(response.status).toBe(405)
    expect(payload.error).toMatch(/method not allowed/i)
  })
})
