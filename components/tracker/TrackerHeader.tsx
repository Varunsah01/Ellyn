"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RefObject } from "react";

interface TrackerHeaderProps {
  title?: string;
  searchPlaceholder?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
  onCreateContact?: () => void;
  compact?: boolean;
}

export function TrackerHeader({
  title = "Tracker",
  searchPlaceholder = "Company name wise search",
  searchQuery,
  onSearchChange,
  searchInputRef,
  onCreateContact,
  compact = false,
}: TrackerHeaderProps) {
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className={`space-y-3 transition-all duration-200 ${compact ? "space-y-2" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(280px,1fr)_auto] sm:items-center">
        <h1 className={`font-fraunces font-bold tracking-tight sm:justify-self-start ${compact ? "text-2xl" : "text-3xl"}`}>
          {title}
        </h1>

        <div className="relative w-full sm:max-w-none sm:justify-self-stretch">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className={`rounded-lg border border-[#E5E7EB] bg-white py-2 pl-10 pr-10 text-sm focus-visible:border-[#FF7B7B] focus-visible:ring-1 focus-visible:ring-[#FF7B7B] dark:border-slate-700 dark:bg-slate-900 ${compact ? "h-9" : "h-10"}`}
          />

          {hasQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40 rounded-sm"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex justify-end sm:justify-self-end">
          <Button
            type="button"
            variant="outline"
            className={`${compact ? "h-9" : "h-10"} min-w-28 border-[#FF7B7B]/30 text-[#FF7B7B] hover:border-[#FF7B7B] hover:text-[#ff6b6b]`}
            onClick={onCreateContact}
          >
            New Contact
          </Button>
        </div>
      </div>
    </div>
  );
}
