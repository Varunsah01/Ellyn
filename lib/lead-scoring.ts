// Lead scoring — computed server-side, never trusted from client

export interface TrackingEvent {
  event_type: "opened" | "clicked" | "replied" | string
  occurred_at: string
}

export interface LeadScore {
  score: number           // 0–100
  grade: "hot" | "warm" | "cold"
  signals: string[]       // human-readable reasons
}

export interface ScoredContact {
  email_verified?: boolean | null
  email_confidence?: number | null
  linkedin_url?: string | null
}

export function computeLeadScore(
  contact: ScoredContact,
  trackingEvents: TrackingEvent[]
): LeadScore {
  let score = 0
  const signals: string[] = []

  // ── Base signals ──────────────────────────────────────────────────────────

  if (contact.email_verified) {
    score += 10
    signals.push("Verified email")
  }
  if ((contact.email_confidence ?? 0) > 80) {
    score += 5
  }
  if (contact.linkedin_url) {
    score += 5
    signals.push("LinkedIn profile")
  }

  // ── Engagement signals ────────────────────────────────────────────────────

  const opens = trackingEvents.filter((e) => e.event_type === "opened").length
  const clicks = trackingEvents.filter((e) => e.event_type === "clicked").length
  const replies = trackingEvents.filter((e) => e.event_type === "replied").length

  score += Math.min(opens * 5, 20)    // max 20 from opens
  score += Math.min(clicks * 10, 20)  // max 20 from clicks
  score += Math.min(replies * 15, 30) // max 30 from replies

  if (opens > 0) signals.push(`Opened email ${opens}x`)
  if (clicks > 0) signals.push(`Clicked link ${clicks}x`)
  if (replies > 0) signals.push("Replied")

  // ── Recency bonus ─────────────────────────────────────────────────────────

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = trackingEvents.some(
    (e) => new Date(e.occurred_at).getTime() > recentCutoff
  )
  if (recent) {
    score += 10
    signals.push("Recently active")
  }

  const clamped = Math.min(100, Math.max(0, score))
  const grade: LeadScore["grade"] =
    clamped >= 60 ? "hot" : clamped >= 30 ? "warm" : "cold"

  return { score: clamped, grade, signals }
}
