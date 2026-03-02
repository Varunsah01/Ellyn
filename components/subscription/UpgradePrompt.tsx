"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

type UpgradePromptVariant = "inline" | "modal";

type UpgradePromptProps = {
  feature?: string;
  used: number;
  limit: number;
  variant?: UpgradePromptVariant;
  open?: boolean;
  onDismiss?: () => void;
};

function InlinePrompt({ used, limit }: { used: number; limit: number }) {
  return (
    <div className="rounded-lg border border-[#FFD7D7] bg-[#FFF5F5] p-4">
      <p className="text-sm font-semibold text-[#7A2E2E]">
        You&apos;ve reached your monthly limit of {limit} lookups.
      </p>
      <p className="mt-1 text-sm text-[#7A2E2E]">
        Upgrade to Starter (500/mo) or Pro (1,500/mo) to continue.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-[#A14A4A]">Current usage: {used} / {limit}</p>
        <Button asChild size="sm">
          <Link href="/dashboard/upgrade">View Plans</Link>
        </Button>
      </div>
    </div>
  );
}

export function UpgradePrompt({
  used,
  limit,
  variant = "inline",
  open,
  onDismiss,
}: UpgradePromptProps) {
  if (variant === "modal") {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss?.()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              You&apos;ve reached your monthly limit of {limit} lookups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Upgrade to Starter (500/mo) or Pro (1,500/mo) to continue.
            </p>
            <p className="text-xs text-slate-500">Current usage: {used} / {limit}</p>
            <div className="flex items-center gap-2">
              <Button asChild className="flex-1">
                <Link href="/dashboard/upgrade">View Plans</Link>
              </Button>
              <Button type="button" variant="outline" onClick={onDismiss}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return <InlinePrompt used={used} limit={limit} />;
}
