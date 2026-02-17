"use client";

import { useMemo } from "react";
import { Filter, LayoutGrid, ListFilter, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/Sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  TRACKER_DATE_PRESET_LABELS,
  TRACKER_SORT_PRESET_LABELS,
  TRACKER_STATUS_LABELS,
  type TrackerDatePreset,
  type TrackerFilterState,
  type TrackerSortPreset,
  type TrackerStatusFilterValue,
} from "@/lib/tracker-v2";

interface CompanyOption {
  company: string;
  count: number;
}

interface ActiveFilterChip {
  key: string;
  label: string;
}

export type TrackerViewMode = "kanban" | "table";

interface TrackerV2ControlsProps {
  sortPreset: TrackerSortPreset;
  onSortPresetChange: (value: TrackerSortPreset) => void;
  filters: TrackerFilterState;
  onFiltersChange: (next: TrackerFilterState) => void;
  companyOptions: CompanyOption[];
  activeFilterChips: ActiveFilterChip[];
  onRemoveFilterChip: (chipKey: string) => void;
  onClearAllFilters: () => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  isMobile: boolean;
  viewMode: TrackerViewMode;
  onViewModeChange: (next: TrackerViewMode) => void;
  condensed: boolean;
  onCondensedChange: (next: boolean) => void;
}

const SORT_PRESETS = Object.keys(TRACKER_SORT_PRESET_LABELS) as TrackerSortPreset[];
const DATE_PRESETS = Object.keys(TRACKER_DATE_PRESET_LABELS) as TrackerDatePreset[];
const STATUS_VALUES = Object.keys(TRACKER_STATUS_LABELS) as TrackerStatusFilterValue[];

interface FilterPanelProps {
  filters: TrackerFilterState;
  onFiltersChange: (next: TrackerFilterState) => void;
  companyOptions: CompanyOption[];
  onClearAllFilters: () => void;
}

function FilterPanel({ filters, onFiltersChange, companyOptions, onClearAllFilters }: FilterPanelProps) {
  const filteredCompanies = useMemo(() => {
    const query = filters.companySearch.trim().toLowerCase();
    const source = companyOptions.filter((option) => option.company.toLowerCase().includes(query));
    if (source.length > 100 && !query) {
      return source.slice(0, 100);
    }
    return source;
  }, [companyOptions, filters.companySearch]);

  const hasCompanyOverflow = companyOptions.length > 100 && !filters.companySearch.trim();

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_VALUES.map((statusValue) => {
            const checked = filters.statuses.includes(statusValue);
            return (
              <label
                key={statusValue}
                className="flex min-h-11 items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    const nextStatuses = nextChecked
                      ? [...filters.statuses, statusValue]
                      : filters.statuses.filter((value) => value !== statusValue);
                    onFiltersChange({ ...filters, statuses: nextStatuses });
                  }}
                />
                <span>{TRACKER_STATUS_LABELS[statusValue]}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Created Date</p>
        <Select
          value={filters.createdPreset}
          onValueChange={(value) => onFiltersChange({ ...filters, createdPreset: value as TrackerDatePreset })}
        >
          <SelectTrigger className="h-10 bg-white dark:bg-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {TRACKER_DATE_PRESET_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="date"
            value={filters.createdFrom}
            onChange={(event) => onFiltersChange({ ...filters, createdFrom: event.target.value })}
            className="h-10"
            aria-label="Created from date"
          />
          <Input
            type="date"
            value={filters.createdTo}
            onChange={(event) => onFiltersChange({ ...filters, createdTo: event.target.value })}
            className="h-10"
            aria-label="Created to date"
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Last Contacted</p>
        <Select
          value={filters.contactedPreset}
          onValueChange={(value) => onFiltersChange({ ...filters, contactedPreset: value as TrackerDatePreset })}
        >
          <SelectTrigger className="h-10 bg-white dark:bg-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {DATE_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {TRACKER_DATE_PRESET_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="date"
            value={filters.contactedFrom}
            onChange={(event) => onFiltersChange({ ...filters, contactedFrom: event.target.value })}
            className="h-10"
            aria-label="Last contacted from date"
          />
          <Input
            type="date"
            value={filters.contactedTo}
            onChange={(event) => onFiltersChange({ ...filters, contactedTo: event.target.value })}
            className="h-10"
            aria-label="Last contacted to date"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contacted-more-than" className="text-xs text-slate-600 dark:text-slate-300">
            More than X days ago
          </Label>
          <Input
            id="contacted-more-than"
            type="number"
            min={0}
            value={filters.contactedMoreThanDays}
            onChange={(event) => onFiltersChange({ ...filters, contactedMoreThanDays: event.target.value })}
            className="h-10"
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company</p>
        <Input
          value={filters.companySearch}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              companySearch: event.target.value,
            })
          }
          placeholder="Search company..."
          className="h-10"
        />
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
          {filteredCompanies.map((option) => {
            const checked = filters.companies.includes(option.company);
            return (
              <label key={option.company} className="flex min-h-9 items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) => {
                      const nextCompanies = nextChecked
                        ? [...filters.companies, option.company]
                        : filters.companies.filter((value) => value !== option.company);
                      onFiltersChange({ ...filters, companies: nextCompanies });
                    }}
                  />
                  {option.company}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{option.count}</span>
              </label>
            );
          })}
          {filteredCompanies.length === 0 ? <p className="text-xs text-slate-500">No companies found.</p> : null}
        </div>
        {hasCompanyOverflow ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing first 100 companies. Type to narrow more results.
          </p>
        ) : null}
        <label className="flex min-h-10 items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <Checkbox
            checked={filters.groupByCompany}
            onCheckedChange={(next) => onFiltersChange({ ...filters, groupByCompany: Boolean(next) })}
          />
          Group rows by company
        </label>
      </section>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClearAllFilters}>
          Clear all filters
        </Button>
      </div>
    </div>
  );
}

/**
 * Render the TrackerV2Controls component.
 * @param {TrackerV2ControlsProps} props - Component props.
 * @returns {unknown} JSX output for TrackerV2Controls.
 * @example
 * <TrackerV2Controls />
 */
export function TrackerV2Controls({
  sortPreset,
  onSortPresetChange,
  filters,
  onFiltersChange,
  companyOptions,
  activeFilterChips,
  onRemoveFilterChip,
  onClearAllFilters,
  filtersOpen,
  onFiltersOpenChange,
  isMobile,
  viewMode,
  onViewModeChange,
  condensed,
  onCondensedChange,
}: TrackerV2ControlsProps) {
  const filterButton = (
    <Button
      type="button"
      variant="outline"
      className="h-11 gap-2 bg-white dark:bg-slate-900"
      aria-label="Open filters"
    >
      <Filter className="h-4 w-4" />
      Filters
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{activeFilterChips.length}</span>
    </Button>
  );

  return (
    <div className="relative z-40 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1 sm:max-w-[260px]">
          <Select value={sortPreset} onValueChange={(value) => onSortPresetChange(value as TrackerSortPreset)}>
            <SelectTrigger className="h-11 bg-white dark:bg-slate-900">
              <SelectValue placeholder="Sort preset" />
            </SelectTrigger>
            <SelectContent>
              {SORT_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {TRACKER_SORT_PRESET_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isMobile ? (
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              className="h-9 gap-1 px-3"
              onClick={() => onViewModeChange("table")}
              aria-pressed={viewMode === "table"}
            >
              <Rows3 className="h-4 w-4" />
              Table
            </Button>
            <Button
              type="button"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              className="h-9 gap-1 px-3"
              onClick={() => onViewModeChange("kanban")}
              aria-pressed={viewMode === "kanban"}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </Button>
          </div>
        ) : null}

        {!isMobile && viewMode === "kanban" ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 bg-white dark:bg-slate-900"
            onClick={() => onCondensedChange(!condensed)}
          >
            {condensed ? "Expanded cards" : "Condensed cards"}
          </Button>
        ) : null}

        {isMobile ? (
          <Sheet open={filtersOpen} onOpenChange={onFiltersOpenChange}>
            <SheetTrigger asChild>{filterButton}</SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-4">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Refine by status, dates, and companies.</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  companyOptions={companyOptions}
                  onClearAllFilters={onClearAllFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Popover open={filtersOpen} onOpenChange={onFiltersOpenChange}>
            <PopoverTrigger asChild>{filterButton}</PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={10}
              collisionPadding={16}
              className="z-[90] w-[min(440px,calc(100vw-2rem))] max-h-[72vh] space-y-4 overflow-y-auto overflow-x-visible rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950"
            >
              <FilterPanel
                filters={filters}
                onFiltersChange={onFiltersChange}
                companyOptions={companyOptions}
                onClearAllFilters={onClearAllFilters}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <ListFilter className="h-3.5 w-3.5 text-slate-500" />
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onRemoveFilterChip(chip.key)}
                className="rounded-sm text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF7B7B]/40"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={onClearAllFilters} className="h-8 px-2 text-xs">
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
