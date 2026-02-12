"use client";

import { useMemo } from "react";
import { Download, Filter, Info, Keyboard, LayoutGrid, ListFilter, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_EXPORT_COLUMNS,
  TRACKER_DATE_PRESET_LABELS,
  TRACKER_EXPORT_COLUMN_LABELS,
  TRACKER_SORT_PRESET_LABELS,
  TRACKER_STATUS_LABELS,
  type TrackerDatePreset,
  type TrackerExportColumn,
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
  exportColumns: TrackerExportColumn[];
  onToggleExportColumn: (column: TrackerExportColumn) => void;
  onResetExportColumns: () => void;
  onExportCurrentView: () => void;
  onExportSelected: () => void;
  selectedCount: number;
  isMobile: boolean;
  viewMode: TrackerViewMode;
  onViewModeChange: (next: TrackerViewMode) => void;
  condensed: boolean;
  onCondensedChange: (next: boolean) => void;
  onOpenShortcuts: () => void;
}

const SORT_PRESETS = Object.keys(TRACKER_SORT_PRESET_LABELS) as TrackerSortPreset[];
const DATE_PRESETS = Object.keys(TRACKER_DATE_PRESET_LABELS) as TrackerDatePreset[];
const STATUS_VALUES = Object.keys(TRACKER_STATUS_LABELS) as TrackerStatusFilterValue[];
const EXPORT_COLUMNS = Object.keys(TRACKER_EXPORT_COLUMN_LABELS) as TrackerExportColumn[];

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
    <div className="space-y-4">
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
          <SelectContent>
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
          <SelectContent>
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
        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
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
  exportColumns,
  onToggleExportColumn,
  onResetExportColumns,
  onExportCurrentView,
  onExportSelected,
  selectedCount,
  isMobile,
  viewMode,
  onViewModeChange,
  condensed,
  onCondensedChange,
  onOpenShortcuts,
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px]">
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
            <PopoverContent align="start" className="w-[360px] space-y-4">
              <FilterPanel
                filters={filters}
                onFiltersChange={onFiltersChange}
                companyOptions={companyOptions}
                onClearAllFilters={onClearAllFilters}
              />
            </PopoverContent>
          </Popover>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 gap-2 bg-white dark:bg-slate-900">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Export options</h3>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Columns</p>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_COLUMNS.map((column) => (
                  <label key={column} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={exportColumns.includes(column)} onCheckedChange={() => onToggleExportColumn(column)} />
                    {TRACKER_EXPORT_COLUMN_LABELS[column]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onResetExportColumns}>
                Reset columns
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onExportCurrentView}>
                Export current view
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedCount === 0}
                className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b]"
                onClick={onExportSelected}
              >
                Export selected
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Default columns: {DEFAULT_EXPORT_COLUMNS.map((column) => TRACKER_EXPORT_COLUMN_LABELS[column]).join(", ")}
            </p>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 bg-white dark:bg-slate-900"
          onClick={onOpenShortcuts}
          aria-label="Open keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
          Shortcuts
        </Button>

        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Info className="h-3.5 w-3.5" />
          <span title="Tip: combine status + last-contacted filters to find high-intent follow-ups.">
            Filter tip
          </span>
        </div>
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
