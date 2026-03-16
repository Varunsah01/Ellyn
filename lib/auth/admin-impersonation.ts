import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const IMPERSONATION_COOKIE_NAME = 'ellyn_admin_impersonation'
const IMPERSONATION_DURATION_MS = 30 * 60 * 1000

type ImpersonationPayload = {
  adminUsername: string
  targetUserId: string
  exp: number
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters')
  }
  return secret
}

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = normalized.length % 4
  if (remainder === 1) return null

  const padded = remainder === 0 ? normalized : `${normalized}${'='.repeat(4 - remainder)}`
  try {
    return new Uint8Array(Buffer.from(padded, 'base64'))
  } catch {
    return null
  }
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), textEncoder.encode(payload))
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`
}

async function verify(token: string): Promise<string | null> {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null

  const payload = token.slice(0, lastDot)
  const signaturePart = token.slice(lastDot + 1)
  const provided = decodeBase64Url(signaturePart)
  if (!provided) return null

  const isValid = await crypto.subtle.verify(
    'HMAC',
    await getSigningKey(),
    provided,
    textEncoder.encode(payload)
  )

  return isValid ? payload : null
}

export async function createImpersonationToken(params: {
  adminUsername: string
  targetUserId: string
  durationMs?: number
}): Promise<string> {
  const payload: ImpersonationPayload = {
    adminUsername: params.adminUsername,
    targetUserId: params.targetUserId,
    exp: Date.now() + (params.durationMs ?? IMPERSONATION_DURATION_MS),
  }

  return sign(encodeBase64Url(textEncoder.encode(JSON.stringify(payload))))
}

export async function parseImpersonationToken(token: string): Promise<ImpersonationPayload | null> {
  const payload = await verify(token)
  if (!payload) return null

  const decoded = decodeBase64Url(payload)
  if (!decoded) return null

  try {
    const data = JSON.parse(textDecoder.decode(decoded)) as Partial<ImpersonationPayload>
    if (!data?.targetUserId || !data?.adminUsername || typeof data.exp !== 'number') return null
    if (Date.now() > data.exp) return null

    return {
      targetUserId: data.targetUserId,
      adminUsername: data.adminUsername,
      exp: data.exp,
    }
  } catch {
    return null
  }
}

export async function getImpersonationSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value
  if (!token) return null
  return parseImpersonationToken(token)
}

export async function getImpersonationSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value
  if (!token) return null
  return parseImpersonationToken(token)
}
