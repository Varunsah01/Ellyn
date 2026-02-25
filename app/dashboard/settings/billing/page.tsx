"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { PlanBadge } from '@/components/subscription/PlanBadge'
import { showToast } from '@/lib/toast'
import { useSubscription } from '@/context/SubscriptionContext'

type Invoice = {
  id: string
  date: string
  amount_paid: number
  currency: string
  status: string | null
  invoice_pdf: string | null
  hosted_invoice_url: string | null
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPage() {
  const searchParams = useSearchParams()
  const { plan_type, subscription_status, current_period_end, quota, isLoading, refresh } = useSubscription()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      showToast.success(
        plan_type === 'starter'
          ? 'Welcome to Starter! Your subscription is now active.'
          : 'Welcome to Pro! Your subscription is now active.'
      )
      refresh()
    }
  }, [searchParams, refresh, plan_type])

  useEffect(() => {
    if (plan_type === 'starter' || plan_type === 'pro') {
      setInvoicesLoading(true)
      fetch('/api/v1/subscription/invoices')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setInvoices(data) })
        .catch(() => {})
        .finally(() => setInvoicesLoading(false))
    }
  }, [plan_type])

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/v1/subscription/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast.error(data.error ?? 'Failed to open billing portal.')
      }
    } finally {
      setPortalLoading(false)
    }
  }

  const isPaidPlan = plan_type === 'starter' || plan_type === 'pro'
  const emailPct = quota.email.limit > 0 ? Math.min(100, (quota.email.used / quota.email.limit) * 100) : 0
  const aiDraftPct = isPaidPlan && quota.ai_draft.limit > 0
    ? Math.min(100, (quota.ai_draft.used / quota.ai_draft.limit) * 100)
    : 0

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-fraunces font-bold">Billing &amp; Plan</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
        </div>

        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Plan
              {!isLoading && (
                <PlanBadge plan={plan_type === 'pro' ? 'pro' : plan_type === 'starter' ? 'starter' : 'free'} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-16 animate-pulse rounded-md bg-muted" />
            ) : (
              <>
                {subscription_status === 'past_due' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Your payment is past due. Please update your payment method to keep access.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-semibold capitalize">{plan_type}</p>
                  </div>
                  {subscription_status && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{subscription_status.replace('_', ' ')}</p>
                    </div>
                  )}
                  {current_period_end && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Next billing date</p>
                      <p className="font-semibold">{formatDate(current_period_end)}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {isPaidPlan ? (
                    <>
                      <Button onClick={handlePortal} disabled={portalLoading} variant="outline">
                        {subscription_status === 'past_due' ? 'Fix Payment' : 'Manage Subscription'}
                      </Button>
                      {plan_type === 'starter' && (
                        <Button asChild>
                          <Link href="/dashboard/upgrade">Upgrade to Pro</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button asChild>
                      <Link href="/dashboard/upgrade">Upgrade Plan</Link>
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Usage This Month */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 animate-pulse rounded bg-muted" />
                <div className="h-8 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Email credits</span>
                    <span className="text-muted-foreground">
                      {quota.email.used} / {quota.email.limit.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={emailPct} className="h-2" />
                </div>

                {isPaidPlan ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">AI draft generations</span>
                      <span className="text-muted-foreground">
                        {quota.ai_draft.used} / {quota.ai_draft.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={aiDraftPct} className="h-2" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">AI draft generations</p>
                    <p className="text-sm text-muted-foreground">
                      Not available on Free plan.{' '}
                      <Link href="/dashboard/upgrade" className="text-primary underline">
                        Upgrade to unlock
                      </Link>
                    </p>
                  </div>
                )}

                {quota.reset_date && (
                  <p className="text-xs text-muted-foreground">
                    Resets on {formatDate(quota.reset_date)}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Billing History (paid plans only) */}
        {isPaidPlan && (
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-left font-medium text-muted-foreground">Date</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Amount</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Status</th>
                        <th className="pb-2 text-left font-medium text-muted-foreground">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-3">{formatDate(inv.date)}</td>
                          <td className="py-3">{formatCurrency(inv.amount_paid, inv.currency)}</td>
                          <td className="py-3 capitalize">{inv.status ?? '-'}</td>
                          <td className="py-3">
                            {inv.hosted_invoice_url ? (
                              <a
                                href={inv.hosted_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : inv.invoice_pdf ? (
                              <a
                                href={inv.invoice_pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline"
                              >
                                PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Feature</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground">Free</th>
                    <th className="pb-2 text-center font-medium text-muted-foreground">Starter</th>
                    <th className="pb-2 text-center font-medium text-primary">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ['Email credits / month', '50', '500', '1,500'],
                    ['AI drafting', '—', 'AI Starter Access', 'Included'],
                    ['Outreach tracking', 'Basic', 'Full dashboard', 'Full dashboard'],
                    ['Contact storage', 'Limited', 'Advanced', 'Unlimited'],
                    ['Data export', '✗', '✓', '✓'],
                    ['Priority sync', '✗', '✓', '✓'],
                    ['Early access', '✗', '✗', '✓'],
                  ].map(([feature, free, starter, pro]) => (
                    <tr key={feature}>
                      <td className="py-2 text-foreground">{feature}</td>
                      <td className="py-2 text-center text-muted-foreground">{free}</td>
                      <td className="py-2 text-center text-muted-foreground">{starter}</td>
                      <td className="py-2 text-center font-medium text-primary">{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
