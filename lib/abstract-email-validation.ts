/**
 * Deprecated email validation shim.
 * Address-level verification is now handled by the SMTP probe pipeline.
 */

export interface AbstractValidationResult {
  email: string
  isValid: boolean
  isDisposable: boolean
  isFreeEmail: boolean
  deliverability: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  qualityScore: number
  confidenceBoost: number
}

export async function validateEmailAbstract(_email: string): Promise<AbstractValidationResult | null> {
  return null
}

export async function batchValidateEmails(
  _emails: string[],
  _maxConcurrent: number = 3
): Promise<Map<string, AbstractValidationResult>> {
  return new Map<string, AbstractValidationResult>()
}
