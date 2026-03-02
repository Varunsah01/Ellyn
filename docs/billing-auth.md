# Billing and Authentication

Last updated: 2026-03-02

## Provider

Payments are integrated with **DodoPayments** (not Stripe).

- ✅ `lib/dodo.ts` exports `getDodoClient()` singleton.
- ✅ `user_profiles.stripe_customer_id` and `user_profiles.stripe_subscription_id` are intentionally retained as legacy column names for Dodo IDs.

## Auth Routes

| Route | Status | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/signup` | ✅ | Creates auth user via service role admin API and returns `{ success, user }`. |
| `POST /api/v1/auth/change-password` | ✅ | Auth-required password update route. |
| `GET /api/v1/auth/gmail` | ✅ | Connect button target/placeholder route. |
| `POST /api/v1/auth/outlook` | ✅ | Connect button target/placeholder route. |

## Subscription/Billing Routes

| Route | Status | Notes |
| --- | --- | --- |
| `POST /api/v1/subscription/checkout` | ✅ | Plan + cycle validation, Dodo customer create/reuse, subscription creation, returns `payment_link`. |
| `POST /api/v1/subscription/portal` | ✅ | Returns Dodo customer portal link for existing customer. |
| `GET /api/v1/subscription/status` | ✅ | Returns plan, subscription state, and quota usage/limits. |
| `GET /api/v1/subscription/invoices` | ✅ | Auth-protected; returns `{ invoices: [] }` when no customer/invoices. |
| `POST /api/v1/dodo/webhook` | ✅ | Signature verification + subscription state updates + webhook event persistence. |

## Quota Contracts (`lib/quota.ts`)

```ts
export class QuotaExceededError extends Error {
  constructor(feature: string, used: number, limit: number, plan_type: string)
}

export async function incrementEmailGeneration(
  userId: string
): Promise<{ used: number; limit: number; plan_type: string }>

export async function incrementAIDraftGeneration(
  userId: string
): Promise<{ used: number; limit: number; plan_type: string }>

export async function getUserQuota(userId: string): Promise<{
  email: { used: number; limit: number; remaining: number }
  ai_draft: { used: number; limit: number; remaining: number }
  reset_date: string | null
  period_start: string | null
  period_end: string | null
  plan_type: string
}>
```

Plan limits:

- Free: email `50`, AI draft `0`
- Starter: email `500`, AI draft `150`
- Pro: email `1500`, AI draft `500`

## Upgrade UX

- ✅ `/dashboard/upgrade` has monthly/quarterly/yearly selector and plan cards.
- ✅ Checkout buttons call `POST /api/v1/subscription/checkout`.
- ✅ On return with `?upgraded=true`, success state is shown and subscription context refreshes usage data.
