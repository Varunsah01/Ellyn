"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import { showToast } from "@/lib/toast";
import { useSubscription } from "@/context/SubscriptionContext";

type BillingCycle = "monthly" | "quarterly" | "yearly";
type PlanType = "free" | "starter" | "pro";
type PaidPlan = Extract<PlanType, "starter" | "pro">;

type PlanDetails = {
  id: PlanType;
  name: string;
  priceByCycle: Record<BillingCycle, string>;
  emailLookups: string;
  aiDrafts: string;
  sequences: string;
  extension: boolean;
  prioritySupport: boolean;
};

const BILLING_OPTIONS: Array<{ value: BillingCycle; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const PLANS: PlanDetails[] = [
  {
    id: "free",
    name: "Free",
    priceByCycle: {
      monthly: "$0",
      quarterly: "$0",
      yearly: "$0",
    },
    emailLookups: "50",
    aiDrafts: "0",
    sequences: "1",
    extension: true,
    prioritySupport: false,
  },
  {
    id: "starter",
    name: "Starter",
    priceByCycle: {
      monthly: "$14.99/mo",
      quarterly: "$39.99/qtr",
      yearly: "$149/yr",
    },
    emailLookups: "500",
    aiDrafts: "150",
    sequences: "10",
    extension: true,
    prioritySupport: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceByCycle: {
      monthly: "$34.99/mo",
      quarterly: "$89.99/qtr",
      yearly: "$279/yr",
    },
    emailLookups: "1,500",
    aiDrafts: "500",
    sequences: "Unlimited",
    extension: true,
    prioritySupport: true,
  },
];

function getPlanDisplayName(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  return "Free";
}

function getPlanAction(currentPlan: PlanType, targetPlan: PlanType) {
  if (targetPlan === currentPlan) {
    return {
      label: "Your current plan",
      disabled: true,
      checkoutPlan: null as PaidPlan | null,
    };
  }

  if (targetPlan === "free") {
    return {
      label: "Free plan",
      disabled: true,
      checkoutPlan: null as PaidPlan | null,
    };
  }

  if (currentPlan === "pro" && targetPlan === "starter") {
    return {
      label: "Included in Pro",
      disabled: true,
      checkoutPlan: null as PaidPlan | null,
    };
  }

  if (targetPlan === "starter") {
    return {
      label: "Upgrade to Starter",
      disabled: false,
      checkoutPlan: "starter" as PaidPlan,
    };
  }

  return {
    label: "Upgrade to Pro",
    disabled: false,
    checkoutPlan: "pro" as PaidPlan,
  };
}

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const { planType, isLoading, refresh } = useSubscription();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);
  const [didShowUpgradeToast, setDidShowUpgradeToast] = useState(false);

  const currentPlan: PlanType = useMemo(() => {
    if (planType === "starter" || planType === "pro") {
      return planType;
    }
    return "free";
  }, [planType]);

  const showUpgradeBanner = searchParams.get("upgraded") === "true";

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      void refresh();
    }
  }, [refresh, searchParams]);

  useEffect(() => {
    if (searchParams.get("upgraded") !== "true" || didShowUpgradeToast || isLoading) {
      return;
    }

    showToast.success(`Welcome to ${getPlanDisplayName(currentPlan)}! Your quota has been updated.`);
    setDidShowUpgradeToast(true);
  }, [currentPlan, didShowUpgradeToast, isLoading, searchParams]);

  const startCheckout = async (plan: PaidPlan) => {
    setLoadingPlan(plan);

    try {
      const response = await supabaseAuthedFetch("/api/v1/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        payment_link?: string;
      };

      if (!response.ok || !data.payment_link) {
        showToast.error("Could not start checkout. Please try again.");
        return;
      }

      window.location.href = data.payment_link;
    } catch {
      showToast.error("Could not start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <PageHeader
        title="Upgrade Plan"
        description="Choose a plan that fits your outreach volume and AI usage."
      />

      <div className="space-y-6">
        {showUpgradeBanner ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6 text-sm font-medium text-emerald-800">
              {"\uD83C\uDF89 You've upgraded! Your new limits are now active."}
            </CardContent>
          </Card>
        ) : null}

        <div className="inline-flex rounded-lg border border-[#D8D6E8] bg-white p-1">
          {BILLING_OPTIONS.map((option) => {
            const active = billingCycle === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setBillingCycle(option.value)}
                className={[
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#2D2B55] text-white"
                    : "text-[#2D2B55] hover:bg-[#F2F1FA]",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const action = getPlanAction(currentPlan, plan.id);
            const isCurrent = plan.id === currentPlan;
            const isLoadingThisPlan = loadingPlan === action.checkoutPlan;

            return (
              <Card key={plan.id} className="border-[#D8D6E8]">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="font-fraunces text-2xl text-[#2D2B55]">{plan.name}</CardTitle>
                    {isCurrent ? (
                      <span className="rounded-full bg-[#2D2B55] px-2.5 py-1 text-xs font-semibold text-white">
                        Your current plan
                      </span>
                    ) : null}
                  </div>
                  <p className="text-2xl font-semibold text-[#2D2B55]">{plan.priceByCycle[billingCycle]}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-[#2D2B55]">
                    <li className="flex items-start justify-between gap-3">
                      <span>Email Lookups/mo</span>
                      <span className="font-medium">{plan.emailLookups}</span>
                    </li>
                    <li className="flex items-start justify-between gap-3">
                      <span>AI Drafts/mo</span>
                      <span className="font-medium">{plan.aiDrafts}</span>
                    </li>
                    <li className="flex items-start justify-between gap-3">
                      <span>Sequences</span>
                      <span className="font-medium">{plan.sequences}</span>
                    </li>
                    <li className="flex items-start justify-between gap-3">
                      <span>Chrome Extension</span>
                      <span aria-label={plan.extension ? "included" : "not included"}>
                        {plan.extension ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-500" />}
                      </span>
                    </li>
                    <li className="flex items-start justify-between gap-3">
                      <span>Priority Support</span>
                      <span aria-label={plan.prioritySupport ? "included" : "not included"}>
                        {plan.prioritySupport ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-500" />}
                      </span>
                    </li>
                  </ul>

                  <Button
                    type="button"
                    onClick={() => {
                      if (action.checkoutPlan) {
                        void startCheckout(action.checkoutPlan);
                      }
                    }}
                    disabled={action.disabled || isLoadingThisPlan || isLoading}
                    className="w-full"
                    variant={plan.id === "pro" ? "default" : "outline"}
                  >
                    {isLoadingThisPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {action.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
