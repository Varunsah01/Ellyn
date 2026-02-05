import { promises as dns } from 'dns';
import * as net from 'net';

export type SMTPResult = 'valid' | 'invalid' | 'unknown';

export interface VerificationResult {
  hasMX: boolean;
  smtpStatus: SMTPResult;
  confidence: number;
  error?: string;
}

/**
 * Check if domain has valid MX records
 * @param domain - Domain to check
 * @returns Promise<boolean> - True if MX records exist
 */
export async function checkMXRecords(domain: string): Promise<boolean> {
  try {
    // Set timeout for DNS lookup
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS lookup timeout')), 5000)
    );

    const mxRecordsPromise = dns.resolveMx(domain);

    const mxRecords = await Promise.race([mxRecordsPromise, timeoutPromise]);

    return mxRecords && mxRecords.length > 0;
  } catch (error) {
    console.error(`MX check failed for ${domain}:`, error);
    return false;
  }
}

/**
 * Verify email address via SMTP
 * @param email - Email address to verify
 * @returns Promise<SMTPResult> - Verification result
 */
export async function verifySMTP(email: string): Promise<SMTPResult> {
  try {
    // Parse domain from email
    const domain = email.split('@')[1];
    if (!domain) {
      return 'invalid';
    }

    // Get MX records
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return 'invalid';
    }

    // Sort by priority (lowest first) and get the first mail server
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mailServer = mxRecords[0].exchange;

    // Perform SMTP verification
    return await performSMTPCheck(mailServer, email);
  } catch (error) {
    console.error(`SMTP verification failed for ${email}:`, error);
    return 'unknown';
  }
}

/**
 * Perform SMTP handshake to verify email
 * @param mailServer - Mail server hostname
 * @param email - Email to verify
 * @returns Promise<SMTPResult>
 */
async function performSMTPCheck(
  mailServer: string,
  email: string
): Promise<SMTPResult> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let result: SMTPResult = 'unknown';
    let step = 0;

    // Timeout handler
    const timeout = setTimeout(() => {
      client.destroy();
      resolve('unknown');
    }, 10000);

    // Connection handler
    client.connect(25, mailServer, () => {
      console.log(`Connected to ${mailServer}`);
    });

    // Data handler
    client.on('data', (data) => {
      const response = data.toString();
      const code = parseInt(response.substring(0, 3));

      console.log(`Step ${step}, Response: ${response.substring(0, 50)}`);

      if (step === 0 && code === 220) {
        // Server greeting received
        step = 1;
        client.write('HELO verify.app\r\n');
      } else if (step === 1 && code === 250) {
        // HELO accepted
        step = 2;
        client.write('MAIL FROM:<verify@verify.app>\r\n');
      } else if (step === 2 && code === 250) {
        // MAIL FROM accepted
        step = 3;
        client.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 3) {
        // RCPT TO response
        if (code === 250) {
          result = 'valid';
        } else if (code === 550 || code === 551 || code === 553) {
          result = 'invalid';
        } else {
          result = 'unknown';
        }

        // Send QUIT and close
        client.write('QUIT\r\n');
        clearTimeout(timeout);
        client.destroy();
        resolve(result);
      }
    });

    // Error handler
    client.on('error', (err) => {
      console.error(`SMTP error for ${email}:`, err.message);
      clearTimeout(timeout);
      client.destroy();
      resolve('unknown');
    });

    // Close handler
    client.on('close', () => {
      clearTimeout(timeout);
      if (result === 'unknown' && step < 3) {
        resolve('unknown');
      }
    });
  });
}

/**
 * Calculate final confidence score
 * @param baseConfidence - Base confidence from pattern matching
 * @param hasMX - Whether domain has MX records
 * @param smtpResult - SMTP verification result
 * @returns number - Final confidence score (0-100)
 */
export function calculateConfidence(
  baseConfidence: number,
  hasMX: boolean,
  smtpResult: SMTPResult
): number {
  let confidence = baseConfidence;

  // Add points for MX records
  if (hasMX) {
    confidence += 20;
  }

  // Add points based on SMTP result
  if (smtpResult === 'valid') {
    confidence += 30;
  } else if (smtpResult === 'unknown') {
    confidence += 15;
  } else if (smtpResult === 'invalid') {
    confidence += 0;
  }

  // Cap at 100
  return Math.min(confidence, 100);
}

/**
 * Verify a single email with full checks
 * @param email - Email address
 * @param domain - Domain to check
 * @param baseConfidence - Base confidence score
 * @returns Promise<VerificationResult>
 */
export async function verifyEmail(
  email: string,
  domain: string,
  baseConfidence: number
): Promise<VerificationResult> {
  try {
    // Check MX records
    const hasMX = await checkMXRecords(domain);

    // Verify via SMTP (only if MX records exist)
    let smtpStatus: SMTPResult = 'unknown';
    if (hasMX) {
      smtpStatus = await verifySMTP(email);
    } else {
      smtpStatus = 'invalid';
    }

    // Calculate final confidence
    const confidence = calculateConfidence(baseConfidence, hasMX, smtpStatus);

    return {
      hasMX,
      smtpStatus,
      confidence,
    };
  } catch (error) {
    console.error(`Verification failed for ${email}:`, error);
    return {
      hasMX: false,
      smtpStatus: 'unknown',
      confidence: baseConfidence,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get verification status label
 */
export function getVerificationLabel(smtpStatus: SMTPResult): string {
  switch (smtpStatus) {
    case 'valid':
      return 'Verified';
    case 'invalid':
      return 'Invalid';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Not Verified';
  }
}

/**
 * Get verification status color
 */
export function getVerificationColor(smtpStatus: SMTPResult): string {
  switch (smtpStatus) {
    case 'valid':
      return 'text-green-600 dark:text-green-400';
    case 'invalid':
      return 'text-red-600 dark:text-red-400';
    case 'unknown':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
