/**
 * @jest-environment node
 */

import {
  createSessionToken,
  parseSessionToken,
  SESSION_DURATION_MS,
} from '@/lib/auth/admin-session'

const FIXED_TIME = new Date('2026-03-09T00:00:00Z')
const TEST_SECRET = 'test-admin-session-secret-1234567890'
const originalSecret = process.env.ADMIN_SESSION_SECRET

describe('admin session tokens', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_TIME)
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    if (typeof originalSecret === 'string') {
      process.env.ADMIN_SESSION_SECRET = originalSecret
      return
    }

    delete process.env.ADMIN_SESSION_SECRET
  })

  test('round trips a signed token into the expected payload', async () => {
    const token = await createSessionToken('admin-user')
    const payload = await parseSessionToken(token)

    expect(payload).toEqual({
      username: 'admin-user',
      exp: FIXED_TIME.getTime() + SESSION_DURATION_MS,
    })
  })

  test('returns null when the signature is tampered with', async () => {
    const token = await createSessionToken('admin-user')
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`

    await expect(parseSessionToken(tamperedToken)).resolves.toBeNull()
  })

  test('returns null when the token is expired', async () => {
    const token = await createSessionToken('admin-user')

    jest.setSystemTime(FIXED_TIME.getTime() + SESSION_DURATION_MS + 1)

    await expect(parseSessionToken(token)).resolves.toBeNull()
  })
})
