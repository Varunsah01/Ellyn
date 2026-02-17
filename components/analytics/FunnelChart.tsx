"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/utils/analytics-calculations";

interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

interface FunnelChartProps {
  title?: string;
  description?: string;
  stages: FunnelStage[];
  className?: string;
}

/**
 * Render the FunnelChart component.
 * @param {FunnelChartProps} props - Component props.
 * @returns {unknown} JSX output for FunnelChart.
 * @example
 * <FunnelChart />
 */
export function FunnelChart({
  title,
  description,
  stages,
  className,
}: FunnelChartProps) {
  const maxValue = stages[0]?.value || 1;

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const percentage = (stage.value / maxValue) * 100;
            const previousStage = index > 0 ? stages[index - 1] : null;
            const conversionRate =
              previousStage && previousStage.value > 0
                ? (stage.value / previousStage.value) * 100
                : 100;

            const defaultColors = [
              "bg-blue-500",
              "bg-purple-500",
              "bg-pink-500",
              "bg-orange-500",
              "bg-green-500",
            ];

            const bgColor = stage.color || defaultColors[index % defaultColors.length];

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {formatNumber(stage.value)}
                    </span>
                    {index > 0 && (
                      <span
                        className={cn(
                          "text-xs",
                          conversionRate >= 50
                            ? "text-green-600 dark:text-green-500"
                            : conversionRate >= 25
                            ? "text-yellow-600 dark:text-yellow-500"
                            : "text-red-600 dark:text-red-500"
                        )}
                      >
                        {formatPercentage(conversionRate, 1)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative h-12 flex items-center">
                  <div
                    className={cn(
                      "h-full rounded transition-all",
                      bgColor,
                      "relative overflow-hidden"
                    )}
                    style={{
                      width: `${percentage}%`,
                      minWidth: "60px",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {(() => {
          const finalStageValue = stages[stages.length - 1]?.value ?? 0;
          return (
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-fraunces">
                {formatPercentage((finalStageValue / maxValue) * 100, 1)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Overall Conversion
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold font-fraunces">
                {formatNumber(finalStageValue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Final Stage
              </p>
            </div>
          </div>
        </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
