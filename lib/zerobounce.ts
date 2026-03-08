/**
 * Compatibility shim for legacy imports.
 * Email validation now uses Abstract API under the hood.
 */

import {
  validateEmailAbstract,
  type AbstractValidationResult,
  type EmailValidationDeliverability,
} from '@/lib/abstract-email-validation'

export type ZeroBounceDeliverability = EmailValidationDeliverability
export type ZeroBounceResult = AbstractValidationResult

export async function verifyEmailZeroBounce(email: string): Promise<ZeroBounceResult> {
  return validateEmailAbstract(email)
}
