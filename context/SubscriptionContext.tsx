"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type PlanType = "free" | "starter" | "pro";

type SubscriptionApiPayload = {
  plan_type?: PlanType;
  subscription_status?: string | null;
  email_lookups_used?: number | null;
  email_lookups_limit?: number | null;
  ai_draft_generations_used?: number | null;
  ai_draft_generations_limit?: number | null;
  reset_date?: string | null;
};

type SubscriptionProviderState = {
  planType: PlanType;
  subscriptionStatus: string | null;
  emailLookupsUsed: number;
  emailLookupsLimit: number;
  aiDraftUsed: number;
  aiDraftLimit: number;
  resetDate: string | null;
  isLoading: boolean;
};

// Backward-compatible fields kept for existing consumers.
export type SubscriptionState = SubscriptionProviderState & {
  plan_type: PlanType;
  subscription_status: string | null;
  current_period_end: string | null;
  quota: {
    email: { used: number; limit: number };
    ai_draft: { used: number; limit: number };
    reset_date: string | null;
  };
  refresh: () => Promise<void>;
};

const defaultState: SubscriptionState = {
  planType: "free",
  subscriptionStatus: null,
  emailLookupsUsed: 0,
  emailLookupsLimit: 50,
  aiDraftUsed: 0,
  aiDraftLimit: 0,
  resetDate: null,
  isLoading: true,

  plan_type: "free",
  subscription_status: null,
  current_period_end: null,
  quota: {
    email: { used: 0, limit: 50 },
    ai_draft: { used: 0, limit: 0 },
    reset_date: null,
  },
  refresh: async () => {},
};

const SubscriptionContext = createContext<SubscriptionState>(defaultState);

function toSafeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizePlanType(value: unknown): PlanType {
  return value === "starter" || value === "pro" ? value : "free";
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionProviderState>({
    planType: "free",
    subscriptionStatus: null,
    emailLookupsUsed: 0,
    emailLookupsLimit: 50,
    aiDraftUsed: 0,
    aiDraftLimit: 0,
    resetDate: null,
    isLoading: true,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/subscription/status");
      if (!response.ok) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const data = (await response.json()) as SubscriptionApiPayload;
      const planType = normalizePlanType(data.plan_type);

      setState({
        planType,
        subscriptionStatus: data.subscription_status ?? null,
        emailLookupsUsed: toSafeInt(data.email_lookups_used, 0),
        emailLookupsLimit: toSafeInt(data.email_lookups_limit, 50),
        aiDraftUsed: toSafeInt(data.ai_draft_generations_used, 0),
        aiDraftLimit: toSafeInt(data.ai_draft_generations_limit, 0),
        resetDate: data.reset_date ?? null,
        isLoading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const value = useMemo<SubscriptionState>(() => {
    return {
      ...state,
      plan_type: state.planType,
      subscription_status: state.subscriptionStatus,
      current_period_end: null,
      quota: {
        email: {
          used: state.emailLookupsUsed,
          limit: state.emailLookupsLimit,
        },
        ai_draft: {
          used: state.aiDraftUsed,
          limit: state.aiDraftLimit,
        },
        reset_date: state.resetDate,
      },
      refresh: fetchStatus,
    };
  }, [fetchStatus, state]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
