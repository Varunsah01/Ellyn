"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";

export interface ContactFilters {
  statuses: string[];
  confidenceLevel: "any" | "high" | "medium" | "low";
  hasEmail: "all" | "with" | "without";
  tags: string[];
  sources: string[];
}

export const DEFAULT_FILTERS: ContactFilters = {
  statuses: [],
  confidenceLevel: "any",
  hasEmail: "all",
  tags: [],
  sources: [],
};

export function countActiveFilters(f: ContactFilters): number {
  let n = 0;
  if (f.statuses.length) n++;
  if (f.confidenceLevel !== "any") n++;
  if (f.hasEmail !== "all") n++;
  if (f.tags.length) n++;
  if (f.sources.length) n++;
  return n;
}

const STATUS_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Replied", value: "replied" },
  { label: "No Response", value: "no_response" },
];

const SOURCE_OPTIONS = [
  { label: "Manual", value: "manual" },
  { label: "Extension", value: "extension" },
  { label: "CSV Import", value: "csv_import" },
];

interface FilterPanelProps {
  filters: ContactFilters;
  allUserTags: string[];
  onChange: (filters: ContactFilters) => void;
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            value === opt.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background text-muted-foreground hover:border-primary/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiCheckbox({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export function FilterPanel({ filters, allUserTags, onChange }: FilterPanelProps) {
  const [draft, setDraft] = useState<ContactFilters>(filters);
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clearAll = () => {
    const reset = { ...DEFAULT_FILTERS };
    setDraft(reset);
    onChange(reset);
    setOpen(false);
  };

  // Sync draft when popover opens
  const handleOpenChange = (o: boolean) => {
    if (o) setDraft(filters);
    setOpen(o);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2">
          <Filter className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-4 space-y-4" align="end">
        {/* Status */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <MultiCheckbox
            options={STATUS_OPTIONS}
            selected={draft.statuses}
            onChange={(v) => setDraft({ ...draft, statuses: v })}
          />
        </div>

        {/* Email confidence */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Email Confidence
          </p>
          <Select
            value={draft.confidenceLevel}
            onValueChange={(v) =>
              setDraft({
                ...draft,
                confidenceLevel: v as ContactFilters["confidenceLevel"],
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="high">High (80%+)</SelectItem>
              <SelectItem value="medium">Medium (50–79%)</SelectItem>
              <SelectItem value="low">Low (&lt;50%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Has email */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Has Email
          </p>
          <ToggleGroup
            options={[
              { label: "All", value: "all" },
              { label: "With email", value: "with" },
              { label: "Without", value: "without" },
            ]}
            value={draft.hasEmail}
            onChange={(v) =>
              setDraft({ ...draft, hasEmail: v as ContactFilters["hasEmail"] })
            }
          />
        </div>

        {/* Tags */}
        {allUserTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {allUserTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const next = draft.tags.includes(tag)
                      ? draft.tags.filter((t) => t !== tag)
                      : [...draft.tags, tag];
                    setDraft({ ...draft, tags: next });
                  }}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    draft.tags.includes(tag)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Source
          </p>
          <MultiCheckbox
            options={SOURCE_OPTIONS}
            selected={draft.sources}
            onChange={(v) => setDraft({ ...draft, sources: v })}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear all
          </button>
          <Button size="sm" onClick={apply} className="h-7 text-xs px-3">
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
