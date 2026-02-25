"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import {
  DEFAULT_PRICING_REGION,
  FREE_PLAN_FEATURES,
  STARTER_PLAN_FEATURES,
  PRO_PLAN_FEATURES,
  getFreeDisplayPrice,
  getStarterDisplayPrice,
  getProDisplayPrice,
  getQuarterlySavingsLabel,
  getYearlySavingsLabel,
} from "@/lib/pricing-config";
import { PricingCard } from "@/components/landing/pricing/PricingCard";
import { PricingToggle } from "@/components/landing/pricing/PricingToggle";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState("monthly");

  const freePrice = useMemo(
    () => getFreeDisplayPrice(DEFAULT_PRICING_REGION),
    [],
  );
  const starterPrice = useMemo(
    () => getStarterDisplayPrice(DEFAULT_PRICING_REGION, billingCycle),
    [billingCycle],
  );
  const proPrice = useMemo(
    () => getProDisplayPrice(DEFAULT_PRICING_REGION, billingCycle),
    [billingCycle],
  );
  const quarterlySavingsLabel = useMemo(
    () => getQuarterlySavingsLabel(DEFAULT_PRICING_REGION),
    [],
  );
  const yearlySavingsLabel = useMemo(
    () => getYearlySavingsLabel(DEFAULT_PRICING_REGION),
    [],
  );

  // Starter doesn't offer yearly billing — show fallback note when yearly is selected
  const starterBillingLabel =
    billingCycle === "yearly"
      ? "/quarter (billed quarterly)"
      : starterPrice.periodLabel;

  return (
    <section
      id="pricing"
      className="scroll-mt-24 md:scroll-mt-28 py-16 md:py-24 lg:py-28 bg-[radial-gradient(120%_140%_at_50%_0%,rgba(14,165,233,0.12),rgba(255,255,255,0.95))]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeInUp}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg md:text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Start free with 50 email lookups. Scale up as your outreach grows.
          </p>
        </motion.div>

        <PricingToggle
          billingCycle={billingCycle}
          onBillingCycleChange={setBillingCycle}
          quarterlySavingsLabel={quarterlySavingsLabel}
          yearlySavingsLabel={yearlySavingsLabel}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
          <PricingCard
            planName="Free"
            planSubtitle="Perfect to get started"
            priceLabel={freePrice.amountLabel}
            billingLabel={freePrice.periodLabel}
            features={FREE_PLAN_FEATURES}
            ctaLabel="Start Free"
            ctaHref="/auth/signup"
            supportText="No credit card required"
            priceKey="global-free"
          />

          <PricingCard
            planName="Starter"
            planSubtitle="For growing your outreach"
            priceLabel={starterPrice.amountLabel}
            billingLabel={starterBillingLabel}
            features={STARTER_PLAN_FEATURES}
            ctaLabel="Get Started"
            ctaHref="/auth/signup?plan=starter"
            badgeLabel="Best Value"
            savingsBadge={starterPrice.savingsLabel || ""}
            priceKey={`global-${billingCycle}-starter`}
          />

          <PricingCard
            planName="Pro"
            planSubtitle="For power users & teams"
            priceLabel={proPrice.amountLabel}
            billingLabel={proPrice.periodLabel}
            features={PRO_PLAN_FEATURES}
            ctaLabel="Upgrade to Pro"
            ctaHref="/auth/signup?plan=pro"
            isPopular
            badgeLabel="Most Popular"
            underPriceText="*Fair usage applies"
            savingsBadge={proPrice.savingsLabel || ""}
            priceKey={`global-${billingCycle}-pro`}
          />
        </div>
      </div>
    </section>
  );
}
