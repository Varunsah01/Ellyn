import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/helpers'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const FALLBACK_RESPONSE = {
  confirmed: true,
  correctedDomain: null,
  confidence: null,
  reason: 'gemini_unavailable',
}

function buildGeminiPrompt(companyName: string, domain: string): string {
  return (
    `You are a business domain expert. A LinkedIn profile lists company name: '${companyName}'. ` +
    `We resolved their email domain as: '${domain}'. ` +
    `Confirm if this is their correct primary business email domain.\n\n` +
    `Respond ONLY with valid JSON (no markdown, no explanation):\n` +
    `{"confirmed": boolean, "corrected_domain": string or null, "confidence": number between 0 and 1, "reason": string}`
  )
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const companyName = String(body?.companyName || '').trim()
    const domain = String(body?.domain || '').trim()

    if (!companyName || !domain) {
      return NextResponse.json(
        { error: 'companyName and domain are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      console.warn('[confirm-domain] GEMINI_API_KEY is not configured')
      return NextResponse.json(FALLBACK_RESPONSE)
    }

    const url = `${GEMINI_API_URL}?key=${apiKey}`

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildGeminiPrompt(companyName, domain) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 150,
        },
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!geminiResponse.ok) {
      console.warn('[confirm-domain] Gemini API returned', geminiResponse.status)
      return NextResponse.json(FALLBACK_RESPONSE)
    }

    const geminiData = await geminiResponse.json()
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    let parsed: {
      confirmed?: boolean
      corrected_domain?: string | null
      confidence?: number
      reason?: string
    }

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.warn('[confirm-domain] Failed to parse Gemini JSON:', cleaned)
      return NextResponse.json(FALLBACK_RESPONSE)
    }

    return NextResponse.json({
      confirmed: parsed.confirmed !== false,
      correctedDomain: parsed.corrected_domain || null,
      confidence:
        typeof parsed.confidence === 'number' ? parsed.confidence : null,
      reason: parsed.reason || '',
    })
  } catch (error) {
    console.warn('[confirm-domain] Unexpected error:', error)
    return NextResponse.json(FALLBACK_RESPONSE)
  }
}
