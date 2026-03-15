/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockCreateClient = jest.fn()
const mockExchangeCodeForSession = jest.fn()
const mockGetSession = jest.fn()
const mockSignInWithOAuth = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { GET as startOAuth } from '@/app/auth/oauth/start/route'
import { GET as callbackOAuth } from '@/app/auth/callback/route'

describe('OAuth server routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getSession: mockGetSession,
        signInWithOAuth: mockSignInWithOAuth,
      },
    })

    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?test=1' },
      error: null,
    })
  })

  test('start route redirects to Supabase oauth url and forwards next to callback', async () => {
    const request = new NextRequest(
      'http://localhost:3000/auth/oauth/start?provider=google&next=%2Fdashboard%2Fcontacts'
    )

    const response = await startOAuth(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?test=1')
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard%2Fcontacts',
      },
    })
  })

  test('callback route exchanges code and redirects to sanitized next path', async () => {
    const request = new NextRequest(
      'http://localhost:3000/auth/callback?code=test-auth-code&next=%2Fextension-auth%3Fsource%3Dpopup%26extensionId%3Dext-1'
    )

    const response = await callbackOAuth(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-auth-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/extension-auth?source=popup&extensionId=ext-1'
    )
  })

  test('start route rejects unsupported providers and preserves safe next on login redirect', async () => {
    const request = new NextRequest(
      'http://localhost:3000/auth/oauth/start?provider=github&next=https%3A%2F%2Fevil.example'
    )

    const response = await startOAuth(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/login?oauth_error=Unsupported+OAuth+provider&redirect=%2Fdashboard'
    )
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })
})
