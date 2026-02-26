import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:       z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:  z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:      z.string().min(1),
  NEXT_PUBLIC_APP_URL:            z.string().url().default('http://localhost:3000'),
  ZEROBOUNCE_API_KEY:             z.string().min(1),
  DODO_PAYMENTS_API_KEY:          z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY:      z.string().min(1),
  SECRET_ADMIN_TOKEN:             z.string().min(32),
})

// Validate at module import time so misconfigured environments fail loudly.
export const env = envSchema.parse(process.env)
