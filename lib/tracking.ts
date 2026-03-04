type TrackingTokenPayload = {
  userId: string
  contactId?: string
  // draft context (existing)
  draftId?: string
  // sequence context
  enrollmentStepId?: string
  enrollmentId?: string
  sequenceId?: string
  // direct send context
  trackingId?: string
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
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >

    const userId = typeof decoded.userId === 'string' ? decoded.userId.trim() : ''
    if (!userId) return null

    const draftId =
      typeof decoded.draftId === 'string' && decoded.draftId.trim()
        ? decoded.draftId.trim()
        : undefined
    const enrollmentStepId =
      typeof decoded.enrollmentStepId === 'string' && decoded.enrollmentStepId.trim()
        ? decoded.enrollmentStepId.trim()
        : undefined
    const trackingId =
      typeof decoded.trackingId === 'string' && decoded.trackingId.trim()
        ? decoded.trackingId.trim()
        : undefined

    // Must have at least one context identifier
    if (!draftId && !enrollmentStepId && !trackingId) return null

    const contactId =
      typeof decoded.contactId === 'string' && decoded.contactId.trim()
        ? decoded.contactId.trim()
        : undefined
    const enrollmentId =
      typeof decoded.enrollmentId === 'string' && decoded.enrollmentId.trim()
        ? decoded.enrollmentId.trim()
        : undefined
    const sequenceId =
      typeof decoded.sequenceId === 'string' && decoded.sequenceId.trim()
        ? decoded.sequenceId.trim()
        : undefined

    return {
      userId,
      ...(draftId ? { draftId } : {}),
      ...(enrollmentStepId ? { enrollmentStepId } : {}),
      ...(enrollmentId ? { enrollmentId } : {}),
      ...(sequenceId ? { sequenceId } : {}),
      ...(trackingId ? { trackingId } : {}),
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

export function generateSequenceTrackingPixelUrl(payload: {
  enrollmentStepId: string
  enrollmentId: string
  sequenceId: string
  userId: string
  contactId: string
}): string {
  const token = generateTrackingToken(payload)
  return `${getAppUrl()}/api/track/open?t=${token}`
}

export function generateDirectTrackingPixelUrl(payload: {
  trackingId: string
  userId: string
  contactId?: string
}): string {
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
