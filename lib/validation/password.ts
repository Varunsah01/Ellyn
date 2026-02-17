import { COMMON_PASSWORDS_SET } from '@/lib/validation/common-passwords'

export type PasswordRequirementId =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special'
  | 'notCommon'

export interface PasswordRequirementStatus {
  id: PasswordRequirementId
  label: string
  met: boolean
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
  isValid: boolean
  feedback: string[]
  requirements: PasswordRequirementStatus[]
}

const MIN_PASSWORD_LENGTH = 8
const UPPERCASE_REGEX = /[A-Z]/
const LOWERCASE_REGEX = /[a-z]/
const NUMBER_REGEX = /[0-9]/
const SPECIAL_REGEX = /[^A-Za-z0-9]/

function toStrengthLabel(score: number): PasswordStrengthResult['label'] {
  if (score <= 0) return 'Very Weak'
  if (score === 1) return 'Weak'
  if (score === 2) return 'Fair'
  if (score === 3) return 'Strong'
  return 'Very Strong'
}

/**
 * Validates password strength against application security requirements.
 * @param {string} password - Raw password input to validate.
 * @returns {PasswordStrengthResult} Structured strength score, requirement checks, and user feedback.
 * @example
 * validatePasswordStrength('Abcd1234!')
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const raw = typeof password === 'string' ? password : ''
  const normalized = raw.trim()
  const lowered = normalized.toLowerCase()

  const checks: PasswordRequirementStatus[] = [
    {
      id: 'minLength',
      label: `Minimum ${MIN_PASSWORD_LENGTH} characters`,
      met: normalized.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter',
      met: UPPERCASE_REGEX.test(normalized),
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter',
      met: LOWERCASE_REGEX.test(normalized),
    },
    {
      id: 'number',
      label: 'At least 1 number',
      met: NUMBER_REGEX.test(normalized),
    },
    {
      id: 'special',
      label: 'At least 1 special character',
      met: SPECIAL_REGEX.test(normalized),
    },
    {
      id: 'notCommon',
      label: 'Not a common password',
      met: lowered.length > 0 && !COMMON_PASSWORDS_SET.has(lowered),
    },
  ]

  const complexityMet = checks
    .filter((check) => check.id !== 'notCommon')
    .filter((check) => check.met).length

  let score = Math.min(4, Math.floor((complexityMet / 5) * 4)) as 0 | 1 | 2 | 3 | 4

  const commonPasswordCheck = checks.find((check) => check.id === 'notCommon')
  if (commonPasswordCheck && !commonPasswordCheck.met) {
    score = Math.min(score, 1) as 0 | 1 | 2 | 3 | 4
  }

  const feedback = checks.filter((check) => !check.met).map((check) => check.label)
  const isValid = checks.every((check) => check.met)

  return {
    score,
    label: toStrengthLabel(score),
    isValid,
    feedback,
    requirements: checks,
  }
}

