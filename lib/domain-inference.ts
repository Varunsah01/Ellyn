/**
 * Gemini Flash fallback for inferring corporate email domains.
 * Used when primary domain resolution yields no MX records.
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'

export type DomainInferenceConfidence = 'high' | 'medium' | 'low'

export interface DomainInferenceResult {
  inferredDomain: string | null
  confidence: DomainInferenceConfidence
  reasoning: string
  alternativeDomains: string[]
}

function normalizeDomain(value: unknown): string | null {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null

  const withoutProtocol = raw.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const hostname = withoutProtocol.split('/')[0]?.split('?')[0]?.split('#')[0] || ''
  if (!hostname) return null

  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(hostname) ? hostname : null
}

function normalizeConfidence(value: unknown): DomainInferenceConfidence {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return 'low'
}

function buildPrompt(companyName: string, failedDomain: string, linkedinUrl: string): string {
  return `You are an expert at finding corporate email domains for companies.

A company named "${companyName}" was found but their domain "${failedDomain}" has no MX records (cannot receive email).
${linkedinUrl ? `Their LinkedIn URL is: ${linkedinUrl}` : ''}

Your task: Identify the most likely domain where this company actually receives corporate email.

Consider:
- They may use a different TLD (.co, .io, .ai, .net, .org, .vc, .us, etc.)
- The domain might be slightly different from what was found
- Small companies may use a parent company's domain
- VC firms often use .vc or .capital domains
- Tech startups often use .io or .ai

Return ONLY valid JSON (no markdown, no backticks):
{
  "inferredDomain": "most-likely-domain.com",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation",
  "alternativeDomains": ["alt1.com", "alt2.io"]
}

If you truly cannot determine a domain, set inferredDomain to null.`
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timer)
    },
    { once: true }
  )
  return controller.signal
}

export async function inferDomainWithGemini(
  companyName: string,
  failedDomain: string,
  linkedinUrl = ''
): Promise<DomainInferenceResult> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    ''

  if (!apiKey) {
    return {
      inferredDomain: null,
      confidence: 'low',
      reasoning: 'No Gemini API key configured.',
      alternativeDomains: [],
    }
  }

  const prompt = buildPrompt(companyName, failedDomain, linkedinUrl)

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      }),
      signal: timeoutSignal(10000),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`)
    }

    const data = await response.json()
    const rawText = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .replace(/```json\s*/gi, '')
      .replace(/```/g, '')
      .trim()

    const parsed = JSON.parse(rawText)
    const inferredDomain = normalizeDomain(parsed?.inferredDomain)
    const alternatives = Array.isArray(parsed?.alternativeDomains)
      ? parsed.alternativeDomains
          .map((entry: unknown) => normalizeDomain(entry))
          .filter((entry: string | null): entry is string => Boolean(entry))
          .slice(0, 3)
      : []

    return {
      inferredDomain,
      confidence: normalizeConfidence(parsed?.confidence),
      reasoning: String(parsed?.reasoning || '').trim(),
      alternativeDomains: alternatives,
    }
  } catch (error) {
    console.warn('[DomainInference] Gemini fallback failed:', error)
    return {
      inferredDomain: null,
      confidence: 'low',
      reasoning: 'Inference failed.',
      alternativeDomains: [],
    }
  }
}
