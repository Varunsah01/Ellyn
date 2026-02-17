"use client";

import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";

export function PricingToggle({
  billingCycle,
  onBillingCycleChange,
  yearlySavingsLabel,
}) {
  const isYearly = billingCycle === "yearly";

  return (
    <div className="mx-auto mb-10 flex w-fit flex-wrap items-center justify-center gap-3 rounded-full border border-border bg-white/90 px-4 py-2 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => onBillingCycleChange("monthly")}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-dm-sans font-medium transition-colors",
          !isYearly ? "bg-secondary text-foreground" : "text-muted-foreground",
        )}
      >
        Monthly
      </button>

      <Switch
        aria-label="Toggle yearly billing"
        checked={isYearly}
        onCheckedChange={(checked) =>
          onBillingCycleChange(checked ? "yearly" : "monthly")
        }
      />

      <button
        type="button"
        onClick={() => onBillingCycleChange("yearly")}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-dm-sans font-medium transition-colors",
          isYearly ? "bg-secondary text-foreground" : "text-muted-foreground",
        )}
      >
        Yearly
      </button>

      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-dm-sans font-semibold text-primary">
        {yearlySavingsLabel}
      </span>
    </div>
  );
}
