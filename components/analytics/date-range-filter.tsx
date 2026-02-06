"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  compareEnabled: boolean;
  onCompareToggle: (enabled: boolean) => void;
}

export function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  compareEnabled,
  onCompareToggle,
}: DateRangeFilterProps) {
  const presets = [
    {
      label: "Last 7 days",
      getValue: () => ({
        from: subDays(new Date(), 7),
        to: new Date(),
      }),
    },
    {
      label: "Last 30 days",
      getValue: () => ({
        from: subDays(new Date(), 30),
        to: new Date(),
      }),
    },
    {
      label: "Last 90 days",
      getValue: () => ({
        from: subDays(new Date(), 90),
        to: new Date(),
      }),
    },
    {
      label: "All time",
      getValue: () => undefined,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => onDateRangeChange(preset.getValue())}
            className={cn(
              !dateRange && preset.label === "All time" && "bg-primary text-primary-foreground"
            )}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              dateRange && "bg-accent"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              "Custom range"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Clear filter */}
      {dateRange && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateRangeChange(undefined)}
        >
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}

      {/* Compare toggle */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant={compareEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => onCompareToggle(!compareEnabled)}
        >
          Compare with previous period
        </Button>
        {compareEnabled && (
          <Badge variant="secondary" className="text-xs">
            Comparison active
          </Badge>
        )}
      </div>
    </div>
  );
}
