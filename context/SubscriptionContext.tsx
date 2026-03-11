"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  const [userId, setUserId] = useState<string | null>(null);

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

  // Track the current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUserId(session?.user?.id || null);
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Subscribe to realtime quota changes
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("user-quotas-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_quotas",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newRecord = payload.new;
            setState((prev) => ({
              ...prev,
              emailLookupsUsed: toSafeInt(newRecord.email_lookups_used, prev.emailLookupsUsed),
              emailLookupsLimit: toSafeInt(newRecord.email_lookups_limit, prev.emailLookupsLimit),
              aiDraftUsed: toSafeInt(newRecord.ai_draft_generations_used, prev.aiDraftUsed),
              aiDraftLimit: toSafeInt(newRecord.ai_draft_generations_limit, prev.aiDraftLimit),
              resetDate: newRecord.reset_date ?? prev.resetDate,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

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
