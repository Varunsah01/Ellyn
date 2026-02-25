"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { PricingToggle } from '@/components/landing/pricing/PricingToggle'
import { PricingCard } from '@/components/landing/pricing/PricingCard'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Button } from '@/components/ui/Button'
import { supabaseAuthedFetch } from '@/lib/auth/client-fetch'
import { showToast } from '@/lib/toast'
import {
  type BillingCycle,
  DEFAULT_PRICING_REGION,
  FREE_PLAN_FEATURES,
  STARTER_PLAN_FEATURES,
  PRO_PLAN_FEATURES,
  getFreeDisplayPrice,
  getStarterDisplayPrice,
  getProDisplayPrice,
  getQuarterlySavingsLabel,
  getYearlySavingsLabel,
} from '@/lib/pricing-config'
import { useSubscription } from '@/context/SubscriptionContext'

export default function UpgradePage() {
  const searchParams = useSearchParams()
  const { plan_type, isLoading } = useSubscription()

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [isCheckingOutStarter, setIsCheckingOutStarter] = useState(false)
  const [isCheckingOutPro, setIsCheckingOutPro] = useState(false)
  const [canceledBanner, setCanceledBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      setCanceledBanner(true)
    }
  }, [searchParams])

  const handleUpgrade = async (planType: 'starter' | 'pro') => {
    if (planType === 'starter') {
      setIsCheckingOutStarter(true)
    } else {
      setIsCheckingOutPro(true)
    }
    try {
      const res = await supabaseAuthedFetch('/api/v1/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingCycle, planType }),
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
      setIsCheckingOutStarter(false)
      setIsCheckingOutPro(false)
    }
  }

  const handleManage = async () => {
    const res = await supabaseAuthedFetch('/api/v1/subscription/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      showToast.error(data.error ?? 'Failed to open billing portal.')
    }
  }

  const freePricing = getFreeDisplayPrice(DEFAULT_PRICING_REGION)
  const starterPricing = getStarterDisplayPrice(DEFAULT_PRICING_REGION, billingCycle)
  const proPricing = getProDisplayPrice(DEFAULT_PRICING_REGION, billingCycle)
  const quarterlySavingsLabel = getQuarterlySavingsLabel(DEFAULT_PRICING_REGION)
  const yearlySavingsLabel = getYearlySavingsLabel(DEFAULT_PRICING_REGION)

  const starterBillingLabel = starterPricing.periodLabel

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-8">
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
              quarterlySavingsLabel={quarterlySavingsLabel}
              yearlySavingsLabel={yearlySavingsLabel}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                planName="Starter"
                planSubtitle="For growing your outreach"
                priceLabel={starterPricing.amountLabel}
                billingLabel={starterBillingLabel}
                features={[...STARTER_PLAN_FEATURES]}
                ctaLabel={
                  plan_type === 'starter'
                    ? 'Current Plan'
                    : isCheckingOutStarter
                      ? 'Redirecting...'
                      : 'Get Starter'
                }
                ctaHref="#"
                ctaOnClick={plan_type === 'starter' ? undefined : () => handleUpgrade('starter')}
                ctaDisabled={plan_type === 'starter' || isCheckingOutStarter}
                isPopular={false}
                badgeLabel="Best Value"
                supportText={null}
                underPriceText={null}
                savingsBadge={starterPricing.savingsLabel || null}
                priceKey={`global-${billingCycle}-starter`}
              />

              <PricingCard
                planName="Pro"
                planSubtitle="For power users & teams"
                priceLabel={proPricing.amountLabel}
                billingLabel={proPricing.periodLabel}
                features={[...PRO_PLAN_FEATURES]}
                ctaLabel={isCheckingOutPro ? 'Redirecting...' : 'Upgrade to Pro'}
                ctaHref="#"
                ctaOnClick={() => handleUpgrade('pro')}
                ctaDisabled={isCheckingOutPro}
                isPopular
                badgeLabel="Most Popular"
                supportText={null}
                underPriceText="*Fair usage applies"
                savingsBadge={proPricing.savingsLabel || null}
                priceKey={`global-${billingCycle}-pro`}
              />
            </div>

            {/* CTA buttons */}
            {plan_type !== 'starter' && (
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleUpgrade('starter')}
                  disabled={isCheckingOutStarter}
                  className="min-w-[200px]"
                >
                  {isCheckingOutStarter
                    ? 'Redirecting...'
                    : `Get Starter — ${starterPricing.amountLabel}${starterBillingLabel}`}
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleUpgrade('pro')}
                  disabled={isCheckingOutPro}
                  className="min-w-[200px]"
                >
                  {isCheckingOutPro
                    ? 'Redirecting...'
                    : `Upgrade to Pro — ${proPricing.amountLabel}${proPricing.periodLabel}`}
                </Button>
              </div>
            )}

            {plan_type === 'starter' && (
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={() => handleUpgrade('pro')}
                  disabled={isCheckingOutPro}
                  className="min-w-[200px]"
                >
                  {isCheckingOutPro
                    ? 'Redirecting...'
                    : `Upgrade to Pro — ${proPricing.amountLabel}${proPricing.periodLabel}`}
                </Button>
              </div>
            )}

            {/* Feature comparison table */}
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Free</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Starter</th>
                    <th className="px-4 py-3 text-center font-medium text-primary">Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ['Email credits / month', '50', '500', '1,500'],
                    ['AI drafting', '—', 'AI Starter Access', 'Included'],
                    ['Outreach tracking', 'Basic', 'Full dashboard', 'Full dashboard'],
                    ['Contact storage', 'Limited', 'Advanced', 'Unlimited'],
                    ['Data export', 'No', 'Yes', 'Yes'],
                    ['Priority sync', 'No', 'Yes', 'Yes'],
                    ['Early access to features', 'No', 'No', 'Yes'],
                  ].map(([feature, free, starter, pro]) => (
                    <tr key={feature} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{feature}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{free}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{starter}</td>
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
