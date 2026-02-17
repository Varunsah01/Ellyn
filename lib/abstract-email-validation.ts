/**
 * Abstract Email Validation API Integration
 * OPTIONAL - Disabled by default, can be enabled via environment variable
 * Cost: $0.001 per verification (100x cheaper than Hunter.io)
 */

export interface AbstractValidationResult {
  email: string;
  isValid: boolean;
  isDisposable: boolean;
  isFreeEmail: boolean;
  deliverability: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  qualityScore: number; // 0-100
  confidenceBoost: number; // How much to boost confidence
}

/**
 * Validate email abstract.
 * @param {string} email - Email input.
 * @returns {Promise<AbstractValidationResult | null>} Computed Promise<AbstractValidationResult | null>.
 * @throws {Error} If the operation fails.
 * @example
 * validateEmailAbstract('email')
 */
export async function validateEmailAbstract(email: string): Promise<AbstractValidationResult | null> {
  const API_KEY = process.env.ABSTRACT_EMAIL_VALIDATION_API_KEY;

  // If not configured, skip validation
  if (!API_KEY) {
    console.log('[Abstract] Validation disabled (no API key)');
    return null;
  }

  try {
    const response = await fetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${API_KEY}&email=${encodeURIComponent(email)}`,
      {
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('[Abstract] Validation failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Calculate confidence boost based on deliverability
    let confidenceBoost = 0;
    if (data.deliverability === 'DELIVERABLE') {
      confidenceBoost = 20; // High confidence boost
    } else if (data.deliverability === 'RISKY') {
      confidenceBoost = -10; // Reduce confidence
    } else if (data.deliverability === 'UNDELIVERABLE') {
      confidenceBoost = -30; // Major reduction
    }

    const result: AbstractValidationResult = {
      email,
      isValid: data.is_valid_format?.value === true,
      isDisposable: data.is_disposable_email?.value === true,
      isFreeEmail: data.is_free_email?.value === true,
      deliverability: data.deliverability?.toLowerCase() || 'unknown',
      qualityScore: data.quality_score || 0,
      confidenceBoost
    };

    console.log('[Abstract] Validated:', email, result);

    return result;
  } catch (error) {
    console.warn('[Abstract] Validation error:', error);
    return null;
  }
}

/**
 * Batch validate emails.
 * @param {string[]} emails - Emails input.
 * @param {number} maxConcurrent - Max concurrent input.
 * @returns {Promise<Map<string, AbstractValidationResult>>} Computed Promise<Map<string, AbstractValidationResult>>.
 * @throws {Error} If the operation fails.
 * @example
 * batchValidateEmails('emails', 0)
 */
export async function batchValidateEmails(
  emails: string[],
  maxConcurrent: number = 3
): Promise<Map<string, AbstractValidationResult>> {
  const results = new Map<string, AbstractValidationResult>();

  // Process in batches to avoid rate limits
  for (let i = 0; i < emails.length; i += maxConcurrent) {
    const batch = emails.slice(i, i + maxConcurrent);

    const validations = await Promise.allSettled(
      batch.map(email => validateEmailAbstract(email))
    );

    batch.forEach((email, index) => {
      const result = validations[index];
      if (result && result.status === 'fulfilled' && result.value) {
        results.set(email, result.value);
      }
    });
  }

  return results;
}
