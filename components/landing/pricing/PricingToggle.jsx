"use client";

import { cn } from "@/lib/utils";

export function PricingToggle({
  billingCycle,
  onBillingCycleChange,
  quarterlySavingsLabel,
  yearlySavingsLabel,
}) {
  const options = [
    { key: "monthly", label: "Monthly", savingsLabel: "" },
    { key: "quarterly", label: "Quarterly", savingsLabel: quarterlySavingsLabel || "" },
    { key: "yearly", label: "Yearly", savingsLabel: yearlySavingsLabel || "" },
  ];

  return (
    <div className="mx-auto mb-10 flex w-fit flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-white/90 p-2 shadow-sm backdrop-blur">
      {options.map((option) => {
        const isActive = billingCycle === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onBillingCycleChange(option.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-dm-sans font-medium transition-colors",
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {option.savingsLabel ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {option.savingsLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
