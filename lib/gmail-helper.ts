/**
 * Gmail API Helper Functions
 * Handles OAuth, token refresh, and email formatting
 */

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Generate Google OAuth authorization URL
 * @param clientId - OAuth client ID
 * @param redirectUri - Callback URL after authorization
 * @returns Authorization URL to redirect user to
 */
export function getAuthUrl(clientId: string, redirectUri: string): string {
  const scope = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from Google
 * @param clientId - OAuth client ID
 * @param clientSecret - OAuth client secret
 * @param redirectUri - Same redirect URI used in authorization
 * @returns Token response with access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token
 * @param clientId - OAuth client ID
 * @param clientSecret - OAuth client secret
 * @returns New access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

/**
 * Format email for Gmail API (RFC 2822 format)
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param body - Email body (plain text or HTML)
 * @param isHtml - Whether body is HTML (default: false)
 * @returns Base64url encoded email
 */
export function formatEmail(
  to: string,
  subject: string,
  body: string,
  isHtml: boolean = false
): string {
  const contentType = isHtml ? 'text/html' : 'text/plain';

  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  // Base64url encode (URL-safe base64)
  const base64 = Buffer.from(email).toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send email via Gmail API
 * @param accessToken - Valid Gmail API access token
 * @param encodedMessage - Base64url encoded message
 * @returns Gmail message ID
 */
export async function sendEmail(
  accessToken: string,
  encodedMessage: string
): Promise<string> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  const data = await response.json();
  return data.id; // Gmail message ID
}

/**
 * Get user's email address from Gmail API
 * @param accessToken - Valid Gmail API access token
 * @returns User's email address
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user email: ${error}`);
  }

  const data = await response.json();
  return data.emailAddress;
}

/**
 * Replace template variables in email body
 * @param template - Email template with {{variables}}
 * @param variables - Object with variable values
 * @returns Processed email body
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Simple encryption for credentials (use proper encryption in production)
 * This is a placeholder - use proper encryption library in production
 */
export function encryptCredential(value: string): string {
  // WARNING: This is NOT secure encryption, just base64 encoding
  // In production, use proper encryption like crypto-js or node's crypto module
  return Buffer.from(value).toString('base64');
}

/**
 * Simple decryption for credentials (use proper encryption in production)
 */
export function decryptCredential(encrypted: string): string {
  // WARNING: This is NOT secure decryption, just base64 decoding
  // In production, use proper decryption
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// Backward-compatible token helpers used by API routes
/**
 * Encrypt token.
 * @param {string | null | undefined} value - Value input.
 * @returns {string} Computed string.
 * @example
 * encryptToken('value')
 */
export function encryptToken(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return encryptCredential(value);
}

/**
 * Decrypt token.
 * @param {string | null | undefined} encrypted - Encrypted input.
 * @returns {string} Computed string.
 * @example
 * decryptToken('encrypted')
 */
export function decryptToken(encrypted: string | null | undefined): string {
  if (!encrypted) {
    return "";
  }
  return decryptCredential(encrypted);
}

/**
 * Validate Gmail credentials structure
 */
export function validateGmailCredentials(credentials: any): boolean {
  return (
    credentials &&
    typeof credentials.clientId === 'string' &&
    credentials.clientId.length > 0 &&
    typeof credentials.clientSecret === 'string' &&
    credentials.clientSecret.length > 0
  );
}
