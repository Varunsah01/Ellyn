/**
 * AI Email Pattern Prediction Prompt
 * Optimized for Claude Haiku with deterministic JSON output.
 */

export const EMAIL_PREDICTION_SYSTEM_PROMPT = `You are an expert email pattern prediction system specialized in inferring professional B2B email addresses.

Task:
Given person + company context, predict the most likely email patterns and full candidate emails.

You will receive:
- First/last name
- Company name + domain
- Role/seniority
- Company size estimate (startup, small, medium, large, enterprise)
- Industry (if known)
- Email provider (google, microsoft, custom, unknown)
- Historical pattern outcomes for this domain (if any)

Pattern families to consider:
1) first.last
2) firstlast
3) first
4) flast
5) first.l
6) f.last
7) first_last
8) firstl

Reasoning guidance:
- Enterprise and formal industries (finance, legal, consulting): first.last dominant.
- Startups/small teams: first is more common.
- Founders/C-level at startups: often first.
- Microsoft-heavy environments trend formal; Google can be mixed based on size.
- If historical data exists, treat it as strongest signal.

Historical weighting:
- 80%+ success rate: strong positive boost.
- 50-79%: moderate positive boost.
- <30%: reduce confidence.

Output requirements:
- Return valid JSON only, no markdown.
- Return 4-6 patterns minimum.
- Never return 100 confidence.
- top pattern confidence should usually be 70-90.
- Include concise reasoning (1-2 sentences each).

Expected JSON shape:
{
  "patterns": [
    {
      "email": "first.last@domain.com",
      "pattern": "first.last",
      "confidence": 82,
      "reasoning": "..."
    }
  ],
  "topRecommendation": "first.last@domain.com",
  "recommendationReasoning": "..."
}`

export interface HistoricalPattern {
  pattern: string
  successCount: number
  failureCount: number
  confidenceBoost: number
}

export interface EmailPredictionContext {
  firstName: string
  lastName: string
  companyName: string
  companyDomain: string
  role?: string
  companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  industry?: string | null
  emailProvider?: 'google' | 'microsoft' | 'custom' | 'unknown'
  historicalPatterns?: HistoricalPattern[]
  linkedinUrl?: string
}

export interface AIPredictedPattern {
  email: string
  pattern: string
  confidence: number
  reasoning: string
}

export interface AIEmailPredictionResponse {
  patterns: AIPredictedPattern[]
  topRecommendation: string
  recommendationReasoning: string
}

/**
 * Build structured user message for Claude.
 */
export function buildPredictionUserMessage(context: EmailPredictionContext): string {
  const {
    firstName,
    lastName,
    companyName,
    companyDomain,
    role,
    companySize,
    industry,
    emailProvider,
    historicalPatterns,
    linkedinUrl,
  } = context

  const lines: string[] = [
    '# Contact Information',
    `- Name: ${firstName} ${lastName}`,
    `- Company: ${companyName}`,
    `- Domain: ${companyDomain}`,
    `- Role: ${role || 'Unknown'}`,
    `- Company Size: ${companySize || 'Unknown'}`,
  ]

  if (industry) {
    lines.push(`- Industry: ${industry}`)
  }

  if (emailProvider) {
    lines.push(`- Email Provider: ${emailProvider}`)
  }

  if (linkedinUrl) {
    lines.push(`- LinkedIn: ${linkedinUrl}`)
  }

  if (historicalPatterns && historicalPatterns.length > 0) {
    lines.push('', `# Historical Patterns for ${companyDomain}`)

    for (const pattern of historicalPatterns) {
      const successCount = Math.max(0, Number(pattern.successCount) || 0)
      const failureCount = Math.max(0, Number(pattern.failureCount) || 0)
      const total = successCount + failureCount
      const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

      lines.push(
        `- Pattern: ${pattern.pattern} | Success: ${successRate}% (${successCount} worked, ${failureCount} failed) | Boost: ${pattern.confidenceBoost >= 0 ? '+' : ''}${pattern.confidenceBoost}`
      )
    }
  }

  lines.push(
    '',
    '# Task',
    'Predict the most likely email patterns for this person and return valid JSON only.'
  )

  return lines.join('\n')
}
