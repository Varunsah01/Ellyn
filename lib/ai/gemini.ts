const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export interface GeminiGenerateOptions {
  systemPrompt: string
  userPrompt: string
  maxOutputTokens?: number
  temperature?: number
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

export async function geminiGenerate(
  opts: GeminiGenerateOptions
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const systemPrompt = opts.systemPrompt.trim()
  const userPrompt = opts.userPrompt.trim()

  if (!systemPrompt) {
    throw new Error('systemPrompt is required')
  }
  if (!userPrompt) {
    throw new Error('userPrompt is required')
  }

  const maxOutputTokens = opts.maxOutputTokens ?? 512
  const temperature = opts.temperature ?? 0.7

  const charCount = systemPrompt.length + userPrompt.length
  console.log('[Gemini] tokens ~approx', Math.ceil(charCount / 4))

  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature,
      },
    }),
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(
      `Gemini request failed (${response.status}): ${raw.slice(0, 400)}`
    )
  }

  let payload: GeminiGenerateResponse
  try {
    payload = JSON.parse(raw) as GeminiGenerateResponse
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Gemini returned empty text content')
  }

  return text
}
