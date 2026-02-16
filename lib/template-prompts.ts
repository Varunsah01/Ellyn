export type AiPromptAction =
  | 'enhanceDraft'
  | 'changeTone'
  | 'makeShort'
  | 'makeLong'
  | 'addPersonalization'
  | 'fixGrammar'
  | 'generateFromScratch'

export interface PromptConfig {
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxTokens: number
}

export type PromptVariables = Record<string, string | number | undefined | null>

export const AI_PROMPTS: Record<AiPromptAction, PromptConfig> = {
  enhanceDraft: {
    systemPrompt:
      'You are a career coach writing concise, high-converting outreach emails for job seekers.',
    userPromptTemplate:
      'Improve this outreach email. Keep it professional, specific, and under 150 words. Return plain text only.\n\n{draft}',
    temperature: 0.7,
    maxTokens: 500,
  },
  changeTone: {
    systemPrompt: 'You rewrite emails to match requested tone while preserving intent and core facts.',
    userPromptTemplate:
      'Rewrite this email in a {tone} tone. Keep message and intent the same. Return plain text only.\n\n{draft}',
    temperature: 0.7,
    maxTokens: 500,
  },
  makeShort: {
    systemPrompt: 'You shorten writing while preserving key meaning, asks, and context.',
    userPromptTemplate:
      'Shorten this email to under 100 words, keeping key points and CTA. Return plain text only.\n\n{draft}',
    temperature: 0.4,
    maxTokens: 300,
  },
  makeLong: {
    systemPrompt: 'You expand outreach drafts with relevant detail while preserving authenticity.',
    userPromptTemplate:
      'Expand this email to 200-250 words with concrete details and stronger transitions. Return plain text only.\n\n{draft}',
    temperature: 0.7,
    maxTokens: 800,
  },
  addPersonalization: {
    systemPrompt: 'You personalize outreach using recipient company and sender context with believable detail.',
    userPromptTemplate:
      'Personalize this email for {company}. Highlight why {userName} from {userSchool} is a strong fit. Keep it concise. Return plain text only.\n\n{draft}',
    temperature: 0.8,
    maxTokens: 600,
  },
  fixGrammar: {
    systemPrompt: 'You are a copy editor. Correct grammar, spelling, punctuation, and clarity.',
    userPromptTemplate:
      'Fix grammar, punctuation, and spelling errors in this email. Keep tone and meaning unchanged. Return plain text only.\n\n{draft}',
    temperature: 0.2,
    maxTokens: 500,
  },
  generateFromScratch: {
    systemPrompt:
      'You write professional job seeker outreach emails. Output JSON only with keys: subject and body.',
    userPromptTemplate:
      'Generate a {templateType} outreach email. Focus on: {instructions}. Recipient: {role} at {company}. Sender: {userName}, {userSchool}. Keep body under 170 words. Return valid JSON only.',
    temperature: 0.85,
    maxTokens: 700,
  },
}

/**
 * Build a concrete prompt from template placeholders.
 *
 * Example:
 * buildPrompt('changeTone', { tone: 'friendly', draft: 'Hi...' })
 */
export function buildPrompt(action: AiPromptAction, variables: PromptVariables): string {
  const config = AI_PROMPTS[action]
  return fillTemplate(config.userPromptTemplate, variables)
}

/**
 * Returns prompt config for a named action.
 */
export function getPromptConfig(action: AiPromptAction): PromptConfig {
  return AI_PROMPTS[action]
}

/**
 * Replaces `{variable}` placeholders with provided values.
 */
export function fillTemplate(template: string, variables: PromptVariables): string {
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = variables[token]
    if (value === null || value === undefined) {
      return ''
    }

    return String(value)
  })
}

/**
 * Maps UI action names to prompt action keys.
 */
export function mapEnhanceAction(action: 'enhance' | 'shorten' | 'lengthen' | 'fix-grammar'): AiPromptAction {
  switch (action) {
    case 'enhance':
      return 'enhanceDraft'
    case 'shorten':
      return 'makeShort'
    case 'lengthen':
      return 'makeLong'
    case 'fix-grammar':
      return 'fixGrammar'
    default:
      return 'enhanceDraft'
  }
}
