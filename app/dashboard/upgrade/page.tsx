"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { PricingToggle } from '@/components/landing/pricing/PricingToggle'
import { PricingCard } from '@/components/landing/pricing/PricingCard'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/lib/toast'
import {
  type BillingCycle,
  type PricingRegion,
  FREE_PLAN_FEATURES,
  PRO_PLAN_FEATURES,
  getFreeDisplayPrice,
  getProDisplayPrice,
  getDodoProductId,
  getYearlySavingsLabel,
} from '@/lib/pricing-config'
import { useSubscription } from '@/context/SubscriptionContext'

export default function UpgradePage() {
  const searchParams = useSearchParams()
  const { plan_type, isLoading } = useSubscription()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [region, setRegion] = useState<PricingRegion>('GLOBAL')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [canceledBanner, setCanceledBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      setCanceledBanner(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/v1/pricing-region')
      .then((r) => r.json())
      .then((d) => {
        if (d?.region === 'IN') setRegion('IN')
      })
      .catch(() => {})
  }, [])

  const handleUpgrade = async () => {
    setIsCheckingOut(true)
    try {
      let productId: string
      try {
        productId = getDodoProductId(region)
      } catch {
        showToast.error('Dodo product IDs are not configured.')
        return
      }

      const res = await fetch('/api/v1/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, billingCycle }),
      })

      const data = await res.json()
      if (!res.ok) {
        showToast.error(data.error ?? 'Failed to start checkout.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handleManage = async () => {
    const res = await fetch('/api/v1/subscription/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      showToast.error(data.error ?? 'Failed to open billing portal.')
    }
  }

  const freePricing = getFreeDisplayPrice(region)
  const proPricing = getProDisplayPrice(region, billingCycle)
  const savingsLabel = getYearlySavingsLabel(region)

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-fraunces font-bold">Upgrade Your Plan</h1>
          <p className="mt-2 text-muted-foreground">
            Choose the plan that works best for you.
          </p>
        </div>

        {canceledBanner && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Checkout was canceled. No changes were made.{' '}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setCanceledBanner(false)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!isLoading && plan_type === 'pro' ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-4">
            <p className="text-lg font-semibold">You&apos;re already on Pro!</p>
            <p className="text-muted-foreground text-sm">
              Manage your subscription, update payment info, or view billing history.
            </p>
            <Button onClick={handleManage}>Manage Subscription</Button>
            <div className="mt-2">
              <Link href="/dashboard/settings/billing" className="text-sm text-primary underline">
                View billing details
              </Link>
            </div>
          </div>
        ) : (
          <>
            <PricingToggle
              billingCycle={billingCycle}
              onBillingCycleChange={(cycle: BillingCycle) => setBillingCycle(cycle)}
              yearlySavingsLabel={savingsLabel}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <PricingCard
                planName="Free"
                planSubtitle="Get started at no cost"
                priceLabel={freePricing.amountLabel}
                billingLabel={freePricing.periodLabel}
                features={[...FREE_PLAN_FEATURES]}
                ctaLabel="Current Plan"
                ctaHref="/dashboard"
                isPopular={false}
                badgeLabel={null}
                supportText={null}
                underPriceText={null}
                savingsBadge={null}
                priceKey="free"
              />

              <PricingCard
                planName="Pro"
                planSubtitle="For serious job seekers"
                priceLabel={proPricing.amountLabel}
                billingLabel={proPricing.periodLabel}
                features={[...PRO_PLAN_FEATURES]}
                ctaLabel={isCheckingOut ? 'Redirecting…' : 'Upgrade to Pro'}
                ctaHref="#"
                isPopular
                badgeLabel="Most Popular"
                supportText={null}
                underPriceText={null}
                savingsBadge={billingCycle === 'yearly' ? proPricing.savingsLabel : null}
                priceKey={`${region}-${billingCycle}`}
              />
            </div>

            <div className="text-center">
              <Button
                size="lg"
                onClick={handleUpgrade}
                disabled={isCheckingOut}
                className="min-w-[180px]"
              >
                {isCheckingOut
                  ? 'Redirecting…'
                  : `Upgrade to Pro — ${proPricing.amountLabel}${proPricing.periodLabel}`}
              </Button>
            </div>

            {/* Feature comparison table */}
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Free</th>
                    <th className="px-4 py-3 text-center font-medium text-primary">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ['Email generations / month', '25', '1,500'],
                    ['AI draft generations / month', '15', 'Unlimited'],
                    ['Contact storage', 'Limited', 'Unlimited'],
                    ['Outreach tracking', 'Basic', 'Full dashboard'],
                    ['Data export', '✗', '✓'],
                    ['Priority sync', '✗', '✓'],
                    ['Early access to features', '✗', '✓'],
                  ].map(([feature, free, pro]) => (
                    <tr key={feature} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{feature}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{free}</td>
                      <td className="px-4 py-3 text-center font-medium text-primary">{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
