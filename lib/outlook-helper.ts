/**
 * Microsoft Outlook OAuth Helper Functions
 * Handles Microsoft Identity Platform v2.0 OAuth flow, MS Graph API calls,
 * and AES-256-GCM token encryption using a dedicated OUTLOOK_TOKEN_ENCRYPTION_KEY.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// ---------------------------------------------------------------------------
// Microsoft OAuth constants
// ---------------------------------------------------------------------------

const AUTHORITY = 'https://login.microsoftonline.com/common'
const TOKEN_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/token`
const AUTH_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/authorize`

const SCOPES = [
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
]

// ---------------------------------------------------------------------------
// AES-256-GCM token encryption (dedicated key for Outlook credentials)
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'OUTLOOK_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
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

  // Legacy base64 fallback: if no colons, treat as plain base64
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
// Env var accessors (exported so callers can validate config early)
// ---------------------------------------------------------------------------

export function getMicrosoftClientId(): string {
  const id = process.env.MICROSOFT_CLIENT_ID?.trim()
  if (!id) throw new Error('MICROSOFT_CLIENT_ID env var is not set')
  return id
}

export function getMicrosoftClientSecret(): string {
  const secret = process.env.MICROSOFT_CLIENT_SECRET?.trim()
  if (!secret) throw new Error('MICROSOFT_CLIENT_SECRET env var is not set')
  return secret
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/**
 * Build Microsoft Identity Platform v2.0 authorization URL.
 * Uses /common tenant so both personal and work/school accounts can connect.
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  if (state) {
    params.set('state', state)
  }

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
export interface OutlookTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<OutlookTokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  return response.json() as Promise<OutlookTokenResponse>
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  return { access_token: data.access_token, expires_in: data.expires_in }
}

/**
 * Fetch the signed-in user's email address from MS Graph.
 * Prefers `mail` (Exchange mailbox address) over `userPrincipalName`.
 */
export async function getOutlookEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get user email from MS Graph: ${error}`)
  }

  const data = (await response.json()) as { mail?: string; userPrincipalName?: string }
  return data.userPrincipalName ?? data.mail ?? 'unknown'
}

// ---------------------------------------------------------------------------
// Email send via Microsoft Graph
// ---------------------------------------------------------------------------

export interface OutlookSendOptions {
  to: string
  subject: string
  body: string
  isHtml?: boolean
  from?: string
}

/**
 * Send an email via Microsoft Graph using the two-step draft pattern
 * (POST /me/messages → POST /me/messages/{id}/send) so we can capture
 * the conversationId for reply tracking.
 *
 * Returns { messageId, conversationId }.
 * Throws on non-2xx with the error message from the Graph API response body.
 */
export async function sendEmail(
  accessToken: string,
  options: OutlookSendOptions
): Promise<{ messageId: string; conversationId: string }> {
  const { to, subject, body, isHtml = true } = options

  // Step 1: create the draft message
  const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: body,
      },
      toRecipients: [{ emailAddress: { address: to } }],
    }),
  })

  if (!createResponse.ok) {
    if (createResponse.status === 401) throw new Error('OUTLOOK_REAUTH_REQUIRED')
    const errBody = await createResponse.text().catch(() => createResponse.statusText)
    throw new Error(`Failed to create Outlook draft: ${errBody}`)
  }

  const draft = (await createResponse.json()) as { id: string; conversationId?: string }
  const draftId = draft.id
  const conversationId: string = draft.conversationId ?? draftId

  // Step 2: send the draft
  const sendResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${draftId}/send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!sendResponse.ok && sendResponse.status !== 202) {
    if (sendResponse.status === 401) throw new Error('OUTLOOK_REAUTH_REQUIRED')
    const errBody = await sendResponse.text().catch(() => sendResponse.statusText)
    throw new Error(`Failed to send Outlook draft: ${errBody}`)
  }

  return { messageId: draftId, conversationId }
}
