"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export type DateRange = {
  from: Date;
  to: Date;
};

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  compareEnabled?: boolean;
  onCompareChange?: (enabled: boolean) => void;
}

const presetRanges = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last year", days: 365 },
];

export function DateRangePicker({
  value,
  onChange,
  compareEnabled = false,
  onCompareChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(value);

  const handlePresetClick = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const newRange = { from, to };
    setTempRange(newRange);
    onChange(newRange);
    setIsOpen(false);
  };

  const handleApply = () => {
    onChange(tempRange);
    setIsOpen(false);
  };

  const formatDateRange = (range: DateRange) => {
    try {
      return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`;
    } catch {
      return "Select date range";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{formatDateRange(value)}</span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            <div className="border-r p-3 space-y-1">
              <p className="text-sm font-medium mb-2">Presets</p>
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handlePresetClick(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-3">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Calendar
                    mode="single"
                    selected={tempRange.from}
                    onSelect={(date) =>
                      date && setTempRange({ ...tempRange, from: date })
                    }
                    disabled={(date) =>
                      date > new Date() || date > tempRange.to
                    }
                    initialFocus
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Calendar
                    mode="single"
                    selected={tempRange.to}
                    onSelect={(date) =>
                      date && setTempRange({ ...tempRange, to: date })
                    }
                    disabled={(date) =>
                      date > new Date() || date < tempRange.from
                    }
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApply}>
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {onCompareChange && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="compare"
            checked={compareEnabled}
            onCheckedChange={(checked) => onCompareChange(checked === true)}
          />
          <Label
            htmlFor="compare"
            className="text-sm font-medium cursor-pointer"
          >
            Compare to previous period
          </Label>
        </div>
      )}
    </div>
  );
}
