type TrackingTokenPayload = {
  draftId: string
  userId: string
  contactId?: string
}

const DEFAULT_APP_URL = 'https://app.ellynhq.com'

function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  return configured && configured.length > 0 ? configured : DEFAULT_APP_URL
}

export function generateTrackingToken(payload: TrackingTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeTrackingToken(token: string): TrackingTokenPayload | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Record<string, unknown>
    const draftId = typeof decoded.draftId === 'string' ? decoded.draftId.trim() : ''
    const userId = typeof decoded.userId === 'string' ? decoded.userId.trim() : ''
    const contactId = typeof decoded.contactId === 'string' ? decoded.contactId.trim() : undefined

    if (!draftId || !userId) return null

    return {
      draftId,
      userId,
      ...(contactId ? { contactId } : {}),
    }
  } catch {
    return null
  }
}

export function generateTrackingPixelUrl(
  payload: Parameters<typeof generateTrackingToken>[0]
): string {
  const token = generateTrackingToken(payload)
  return `${getAppUrl()}/api/track/open?t=${token}`
}

export function wrapLink(
  url: string,
  payload: Parameters<typeof generateTrackingToken>[0]
): string {
  const token = generateTrackingToken(payload)
  const encodedUrl = Buffer.from(url).toString('base64url')
  return `${getAppUrl()}/api/track/click?t=${token}&u=${encodedUrl}`
}

export function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

export function injectTrackingPixel(body: string, pixelUrl: string): string {
  const pixel = `\n\n<img src="${pixelUrl}" width="1" height="1" style="display:none" />`
  return `${body}${pixel}`
}
