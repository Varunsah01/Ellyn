"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/analytics-calculations";

interface HeatMapCell {
  row: number;
  col: number;
  value: number;
}

interface HeatMapProps {
  title?: string;
  description?: string;
  data: HeatMapCell[];
  rowLabels: string[];
  colLabels: string[];
  minValue?: number;
  maxValue?: number;
  colorScheme?: "blue" | "green" | "purple" | "red";
  unit?: string;
  className?: string;
}

export function HeatMap({
  title,
  description,
  data,
  rowLabels,
  colLabels,
  minValue,
  maxValue,
  colorScheme = "blue",
  unit = "",
  className,
}: HeatMapProps) {
  const min = minValue ?? Math.min(...data.map((d) => d.value));
  const max = maxValue ?? Math.max(...data.map((d) => d.value));
  const range = max - min || 1;

  const getColorIntensity = (value: number): number => {
    return ((value - min) / range) * 100;
  };

  const getColorClass = (intensity: number): string => {
    const colorSchemes = {
      blue: [
        "bg-blue-50 dark:bg-blue-950/20",
        "bg-blue-100 dark:bg-blue-900/30",
        "bg-blue-200 dark:bg-blue-800/40",
        "bg-blue-300 dark:bg-blue-700/50",
        "bg-blue-400 dark:bg-blue-600/60",
        "bg-blue-500 dark:bg-blue-500/70",
      ],
      green: [
        "bg-green-50 dark:bg-green-950/20",
        "bg-green-100 dark:bg-green-900/30",
        "bg-green-200 dark:bg-green-800/40",
        "bg-green-300 dark:bg-green-700/50",
        "bg-green-400 dark:bg-green-600/60",
        "bg-green-500 dark:bg-green-500/70",
      ],
      purple: [
        "bg-purple-50 dark:bg-purple-950/20",
        "bg-purple-100 dark:bg-purple-900/30",
        "bg-purple-200 dark:bg-purple-800/40",
        "bg-purple-300 dark:bg-purple-700/50",
        "bg-purple-400 dark:bg-purple-600/60",
        "bg-purple-500 dark:bg-purple-500/70",
      ],
      red: [
        "bg-red-50 dark:bg-red-950/20",
        "bg-red-100 dark:bg-red-900/30",
        "bg-red-200 dark:bg-red-800/40",
        "bg-red-300 dark:bg-red-700/50",
        "bg-red-400 dark:bg-red-600/60",
        "bg-red-500 dark:bg-red-500/70",
      ],
    };

    const colors = colorSchemes[colorScheme];
    const index = Math.min(
      Math.floor((intensity / 100) * colors.length),
      colors.length - 1
    );
    return colors[index];
  };

  const getCellValue = (row: number, col: number): number | null => {
    const cell = data.find((d) => d.row === row && d.col === col);
    return cell?.value ?? null;
  };

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex">
              {/* Row labels */}
              <div className="flex flex-col">
                <div className="h-8" /> {/* Spacer for column labels */}
                {rowLabels.map((label, index) => (
                  <div
                    key={index}
                    className="h-10 flex items-center justify-end pr-3 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div>
                {/* Column labels */}
                <div className="flex gap-1 mb-1">
                  {colLabels.map((label, index) => (
                    <div
                      key={index}
                      className="w-10 h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Cells */}
                {rowLabels.map((_, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1 mb-1">
                    {colLabels.map((_, colIndex) => {
                      const value = getCellValue(rowIndex, colIndex);
                      const intensity = value !== null ? getColorIntensity(value) : 0;

                      return (
                        <div
                          key={colIndex}
                          className={cn(
                            "w-10 h-10 rounded flex items-center justify-center text-xs font-medium transition-all hover:scale-110 hover:z-10 relative group cursor-pointer",
                            value !== null
                              ? getColorClass(intensity)
                              : "bg-muted/30"
                          )}
                        >
                          {value !== null && (
                            <>
                              <span className={cn(
                                intensity > 50 ? "text-white" : "text-foreground"
                              )}>
                                {formatNumber(value)}
                              </span>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded shadow-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="font-medium">{rowLabels[rowIndex]}</div>
                                <div className="text-muted-foreground">{colLabels[colIndex]}</div>
                                <div className="font-semibold">{value}{unit}</div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Low</span>
              <div className="flex gap-1">
                {[0, 20, 40, 60, 80].map((intensity) => (
                  <div
                    key={intensity}
                    className={cn("w-6 h-4 rounded", getColorClass(intensity))}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
