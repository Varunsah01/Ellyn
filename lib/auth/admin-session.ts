import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const COOKIE_NAME = 'ellyn_admin_session'
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

export type AdminSessionPayload = {
  username: string
  exp: number
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

type BufferGlobal = {
  from(input: string, encoding: 'base64' | 'binary'): {
    toString(encoding: 'base64' | 'binary'): string
  }
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters')
  }
  return secret
}

function getBufferFallback(): BufferGlobal | null {
  return (globalThis as typeof globalThis & { Buffer?: BufferGlobal }).Buffer ?? null
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  return globalThis.crypto
}

function toBinaryString(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return binary
}

function fromBinaryString(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded: string

  if (typeof btoa === 'function') {
    encoded = btoa(toBinaryString(bytes))
  } else {
    const buffer = getBufferFallback()
    if (!buffer) {
      throw new Error('Base64 encoding is not available')
    }

    encoded = buffer.from(toBinaryString(bytes), 'binary').toString('base64')
  }

  return encoded
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = normalized.length % 4

  if (remainder === 1) {
    return null
  }

  const padded = remainder === 0 ? normalized : `${normalized}${'='.repeat(4 - remainder)}`

  try {
    if (typeof atob === 'function') {
      return fromBinaryString(atob(padded))
    }

    const buffer = getBufferFallback()
    if (!buffer) {
      throw new Error('Base64 decoding is not available')
    }

    return fromBinaryString(buffer.from(padded, 'base64').toString('binary'))
  } catch {
    return null
  }
}

async function getSigningKey(): Promise<CryptoKey> {
  return getWebCrypto().subtle.importKey(
    'raw',
    textEncoder.encode(getSecret()),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  )
}

async function sign(payload: string): Promise<string> {
  const signature = await getWebCrypto().subtle.sign(
    'HMAC',
    await getSigningKey(),
    textEncoder.encode(payload)
  )

  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`
}

async function verify(token: string): Promise<string | null> {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null

  const payload = token.slice(0, lastDot)

  try {
    const provided = decodeBase64Url(token.slice(lastDot + 1))
    if (!provided) return null

    const isValid = await getWebCrypto().subtle.verify(
      'HMAC',
      await getSigningKey(),
      provided as BufferSource,
      textEncoder.encode(payload)
    )

    if (!isValid) return null
  } catch {
    return null
  }

  return payload
}

export async function createSessionToken(username: string): Promise<string> {
  const payload: AdminSessionPayload = {
    username,
    exp: Date.now() + SESSION_DURATION_MS,
  }

  return sign(encodeBase64Url(textEncoder.encode(JSON.stringify(payload))))
}

export async function parseSessionToken(token: string): Promise<AdminSessionPayload | null> {
  const payload = await verify(token)
  if (!payload) return null

  try {
    const decodedPayload = decodeBase64Url(payload)
    if (!decodedPayload) return null

    const data = JSON.parse(textDecoder.decode(decodedPayload)) as Partial<AdminSessionPayload>

    if (typeof data.username !== 'string' || typeof data.exp !== 'number') return null
    if (Date.now() > data.exp) return null

    return {
      username: data.username,
      exp: data.exp,
    }
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return await parseSessionToken(token)
}

export async function getAdminSessionFromRequest(
  request: NextRequest
): Promise<AdminSessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return await parseSessionToken(token)
}
