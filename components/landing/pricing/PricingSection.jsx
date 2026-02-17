"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import {
  DEFAULT_PRICING_REGION,
  FREE_PLAN_FEATURES,
  PRO_PLAN_FEATURES,
  getFreeDisplayPrice,
  getPricingRegionDisplayLabel,
  getProDisplayPrice,
  getYearlySavingsLabel,
  normalizePricingRegion,
} from "@/lib/pricing-config";
import { PricingCard } from "@/components/landing/pricing/PricingCard";
import { PricingToggle } from "@/components/landing/pricing/PricingToggle";

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [region, setRegion] = useState(DEFAULT_PRICING_REGION);

  useEffect(() => {
    let isMounted = true;

    async function loadPricingRegion() {
      try {
        const response = await fetch("/api/v1/pricing-region", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load pricing region (${response.status})`);
        }

        const payload = await response.json();
        const nextRegion = normalizePricingRegion(payload?.region);

        if (isMounted) {
          setRegion(nextRegion);
        }
      } catch (error) {
        console.error("Failed to detect pricing region, defaulting to GLOBAL.", error);
        if (isMounted) {
          setRegion(DEFAULT_PRICING_REGION);
        }
      }
    }

    loadPricingRegion();

    return () => {
      isMounted = false;
    };
  }, []);

  const freePrice = useMemo(() => getFreeDisplayPrice(region), [region]);
  const proPrice = useMemo(
    () => getProDisplayPrice(region, billingCycle),
    [region, billingCycle],
  );
  const yearlySavingsLabel = useMemo(() => getYearlySavingsLabel(region), [region]);
  const regionDisplayLabel = useMemo(
    () => getPricingRegionDisplayLabel(region),
    [region],
  );

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
            Simple Pricing for Serious Job Seekers
          </h2>
          <p className="text-lg md:text-xl font-dm-sans text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you&apos;re ready to accelerate.
          </p>
        </motion.div>

        <PricingToggle
          billingCycle={billingCycle}
          onBillingCycleChange={setBillingCycle}
          yearlySavingsLabel={yearlySavingsLabel}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
          <PricingCard
            planName="Free"
            planSubtitle="Perfect to get started"
            priceLabel={freePrice.amountLabel}
            billingLabel={freePrice.periodLabel}
            features={FREE_PLAN_FEATURES}
            ctaLabel="Start Free"
            ctaHref="/auth/signup"
            supportText="No credit card required"
            priceKey={`${region}-free`}
          />

          <PricingCard
            planName="Pro"
            planSubtitle="Built for high-intent outreach"
            priceLabel={proPrice.amountLabel}
            billingLabel={proPrice.periodLabel}
            features={PRO_PLAN_FEATURES}
            ctaLabel="Upgrade to Pro"
            ctaHref="/auth/signup?plan=pro"
            isPopular
            badgeLabel="Most Popular"
            underPriceText="Unlimited outreach subject to fair use policy."
            savingsBadge={billingCycle === "yearly" ? proPrice.savingsLabel : ""}
            priceKey={`${region}-${billingCycle}-pro`}
          />
        </div>
      </div>
    </section>
  );
}

