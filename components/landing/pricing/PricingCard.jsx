"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function PricingCard({
  planName,
  planSubtitle,
  priceLabel,
  billingLabel,
  features,
  ctaLabel,
  ctaHref,
  isPopular = false,
  badgeLabel,
  supportText,
  underPriceText,
  priceKey,
  savingsBadge,
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("h-full", isPopular && "lg:scale-[1.02]")}
    >
      <Card
        className={cn(
          "relative flex h-full flex-col rounded-2xl border bg-white/95 transition-shadow duration-200",
          isPopular
            ? "border-primary/60 shadow-xl shadow-primary/15"
            : "border-border shadow-sm",
        )}
      >
        {badgeLabel ? (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-dm-sans font-semibold text-white">
            {badgeLabel}
          </span>
        ) : null}

        <CardHeader className={cn("pb-4 text-center", isPopular ? "pt-10" : "pt-8")}>
          <p className="text-lg font-fraunces font-bold text-foreground">{planName}</p>
          <p className="mt-1 text-sm font-dm-sans text-muted-foreground">{planSubtitle}</p>

          <div className="mt-6 flex min-h-[84px] items-end justify-center gap-1">
            <AnimatePresence mode="wait">
              <motion.span
                key={priceKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="text-5xl md:text-6xl font-fraunces font-bold text-foreground"
              >
                {priceLabel}
              </motion.span>
            </AnimatePresence>
            {billingLabel ? (
              <span className="mb-2 text-base font-dm-sans text-muted-foreground">
                {billingLabel}
              </span>
            ) : null}
          </div>

          {savingsBadge ? (
            <span className="mx-auto mt-2 rounded-full bg-green-100 px-2.5 py-1 text-xs font-dm-sans font-semibold text-green-700">
              {savingsBadge}
            </span>
          ) : null}

          {underPriceText ? (
            <p className="mt-3 text-xs font-dm-sans text-muted-foreground">
              {underPriceText}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="flex h-full flex-col px-6 pb-6 md:px-7">
          <ul className="mb-6 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-sm font-dm-sans text-foreground/85">{feature}</span>
              </li>
            ))}
          </ul>

          {supportText ? (
            <p className="mb-5 text-sm font-dm-sans text-muted-foreground">{supportText}</p>
          ) : null}

          <div className="mt-auto">
            <Link href={ctaHref} className="block">
              <Button
                size="lg"
                className={cn(
                  "h-11 w-full font-dm-sans",
                  isPopular
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-secondary text-foreground hover:bg-secondary/80",
                )}
              >
                {ctaLabel}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
