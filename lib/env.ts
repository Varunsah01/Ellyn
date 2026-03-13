const REQUIRED_PUBLIC_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const PUBLIC_ENV_VARS = [
  ...REQUIRED_PUBLIC_ENV_VARS,
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CHROME_EXTENSION_ID',
  'NEXT_PUBLIC_EXTENSION_ID',
  'NEXT_PUBLIC_EXTENSION_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const

const REQUIRED_SERVER_ENV_VARS = ['SUPABASE_SERVICE_ROLE_KEY'] as const

const SERVER_ENV_VARS = [
  ...REQUIRED_SERVER_ENV_VARS,
  'GOOGLE_AI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'EMAILABLE_API_KEY',
  'CLEARBIT_API_KEY',
  'BRANDFETCH_CLIENT_ID',
  'GOOGLE_CUSTOM_SEARCH_API_KEY',
  'GOOGLE_SEARCH_ENGINE_ID',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'KV_REST_API_READ_ONLY_TOKEN',
  'DODO_PAYMENTS_API_KEY',
  'DODO_PAYMENTS_WEBHOOK_KEY',
  'DODO_PAYMENTS_ENVIRONMENT',
  'DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY',
  'DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY',
  'DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY',
  'DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY',
  'DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY',
  'DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY',
  'DODO_PRO_PRODUCT_ID_GLOBAL',
  'SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ENVIRONMENT',
  'ENABLE_DEBUG_ENDPOINTS',
  'SECRET_ADMIN_TOKEN',
  'ADMIN_IP_WHITELIST',
  'ADMIN_API_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GMAIL_TOKEN_ENCRYPTION_KEY',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'OUTLOOK_TOKEN_ENCRYPTION_KEY',
  'CRON_SECRET',
  'SMTP_PROBE_SECRET',
  'SMTP_PROBE_SERVICE_URL',
  'ERROR_MONITORING_WEBHOOK_URL',
] as const

function missingVars(keys: readonly string[]): string[] {
  return keys.filter((key) => !(process.env[key] || '').trim())
}

function throwMissing(scope: 'public' | 'server', names: readonly string[]): never {
  throw new Error(
    `Missing required ${scope} environment variables: ${names.join(', ')}`
  )
}

export function validatePublicEnv(): void {
  const missing = missingVars(REQUIRED_PUBLIC_ENV_VARS)
  if (missing.length > 0) {
    throwMissing('public', missing)
  }
}

export function validateServerEnv(requiredKeys: readonly string[] = REQUIRED_SERVER_ENV_VARS): void {
  const missing = missingVars(requiredKeys)
  if (missing.length > 0) {
    throwMissing('server', missing)
  }
}

export function requirePublicEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required public environment variable: ${name}`)
  }
  return value
}

export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`)
  }
  return value
}

/**
 * Backward-compatible startup validation used by RootLayout/instrumentation.
 * Server-only required variables should be validated at first server use.
 */
export function validateEnv(): void {
  validatePublicEnv()
}

export const env = {
  public: PUBLIC_ENV_VARS,
  server: SERVER_ENV_VARS,
  requiredPublic: REQUIRED_PUBLIC_ENV_VARS,
  requiredServer: REQUIRED_SERVER_ENV_VARS,
} as const
