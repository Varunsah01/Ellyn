import DodoPayments from 'dodopayments'

let client: DodoPayments | null = null

export function getDodoClient(): DodoPayments {
  if (!client) {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY ?? process.env.DODO_API_KEY
    if (!apiKey) throw new Error('Missing DODO_PAYMENTS_API_KEY (or DODO_API_KEY)')

    client = new DodoPayments({
      bearerToken: apiKey,
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test_mode') as
        | 'test_mode'
        | 'live_mode',
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? process.env.DODO_WEBHOOK_SECRET,
    })
  }

  return client
}

// Convenience proxy - lazily initialized on first access
export const dodo: DodoPayments = new Proxy({} as DodoPayments, {
  get(_target, prop) {
    return getDodoClient()[prop as keyof DodoPayments]
  },
})
