/**
 * Gmail API Helper Functions
 * Handles OAuth, AES-256-GCM token encryption, token refresh, and email formatting
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// ---------------------------------------------------------------------------
// AES-256-GCM token encryption
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env.GMAIL_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'GMAIL_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a token with AES-256-GCM.
 * Output format: `iv:tag:ciphertext` (all base64, colon-separated).
 */
export function encryptToken(value: string | null | undefined): string {
  if (!value) return ''

  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

/**
 * Decrypt a token. Detects legacy base64-only format (no `:`) and falls back.
 */
export function decryptToken(encrypted: string | null | undefined): string {
  if (!encrypted) return ''

  // Legacy base64 fallback: if there are no colons, treat as plain base64
  if (!encrypted.includes(':')) {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  }

  const parts = encrypted.split(':')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid encrypted token format')
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const ciphertext = Buffer.from(parts[2], 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

// ---------------------------------------------------------------------------
// OAuth helpers — read client credentials from env vars
// ---------------------------------------------------------------------------

function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!id) throw new Error('GOOGLE_CLIENT_ID env var is not set')
  return id
}

function getClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET env var is not set')
  return secret
}

/**
 * Generate Google OAuth authorization URL using app-level credentials.
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  const scope = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
  })

  if (state) {
    params.set('state', state)
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens using app-level credentials.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token using app-level credentials.
 * Returns `{ access_token, expires_in }`.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const data: TokenResponse = await response.json()
  return { access_token: data.access_token, expires_in: data.expires_in }
}

// ---------------------------------------------------------------------------
// Email formatting & sending
// ---------------------------------------------------------------------------

/**
 * Format email for Gmail API (RFC 2822 format).
 */
export function formatEmail(
  to: string,
  subject: string,
  body: string,
  from?: string,
  isHtml: boolean = false
): string {
  const contentType = isHtml ? 'text/html' : 'text/plain'

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
  ]

  if (from) {
    headers.unshift(`From: ${from}`)
  }

  const email = [...headers, '', body].join('\r\n')

  const base64 = Buffer.from(email).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Send email via Gmail API.
 */
export async function sendEmail(accessToken: string, encodedMessage: string): Promise<string> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Get user's email address from Gmail API.
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get user email: ${error}`)
  }

  const data = await response.json()
  return data.emailAddress
}

/**
 * Revoke a token at Google (best-effort).
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => {
    // Best-effort; ignore errors
  })
}

/**
 * Replace template variables in email body.
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  })
  return result
}
