"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useSubscription } from "@/context/SubscriptionContext";

const DISMISS_KEY = "ellyn_quota_warning_dismissed_until";
const DISMISS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function QuotaWarningBanner() {
  const { emailLookupsUsed, emailLookupsLimit, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const timestamp = Number(raw ?? 0);
      if (Number.isFinite(timestamp) && timestamp > Date.now()) {
        setDismissed(true);
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  const usageRatio = useMemo(() => {
    if (emailLookupsLimit <= 0) return 0;
    return emailLookupsUsed / emailLookupsLimit;
  }, [emailLookupsLimit, emailLookupsUsed]);

  if (isLoading || dismissed || usageRatio < 0.8 || emailLookupsLimit <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 md:flex-row md:items-center md:justify-between">
      <p className="text-sm font-medium">
        You&apos;ve used {emailLookupsUsed} of {emailLookupsLimit} email lookups this month. Upgrade to get more.
      </p>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
          <Link href="/dashboard/upgrade">Upgrade</Link>
        </Button>
        <button
          type="button"
          className="rounded p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Dismiss quota warning"
          onClick={() => {
            const until = Date.now() + DISMISS_WINDOW_MS;
            try {
              localStorage.setItem(DISMISS_KEY, String(until));
            } catch {
              // localStorage unavailable
            }
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
