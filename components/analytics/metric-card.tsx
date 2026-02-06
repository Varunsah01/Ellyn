"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, LucideIcon, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercentage } from "@/lib/utils/analytics-calculations";

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  trend?: "up" | "down" | "neutral";
  sparklineData?: number[];
  format?: "number" | "percentage" | "currency";
  icon?: LucideIcon;
  description?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  sparklineData,
  format = "number",
  icon: Icon,
  description,
  className,
}: MetricCardProps) {
  const formattedValue =
    format === "percentage"
      ? formatPercentage(value, 1)
      : format === "currency"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
        }).format(value)
      : formatNumber(value);

  const trendIcon =
    trend === "up" ? (
      <ArrowUp className="h-4 w-4" />
    ) : trend === "down" ? (
      <ArrowDown className="h-4 w-4" />
    ) : (
      <Minus className="h-4 w-4" />
    );

  const trendColor =
    trend === "up"
      ? "text-green-600 dark:text-green-500"
      : trend === "down"
      ? "text-red-600 dark:text-red-500"
      : "text-muted-foreground";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold font-fraunces">{formattedValue}</div>

          {change !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              <span className={cn("flex items-center gap-1 font-medium", trendColor)}>
                {trendIcon}
                {formatPercentage(Math.abs(change), 1)}
              </span>
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}

          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-3">
              <Sparkline data={sparklineData} trend={trend} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SparklineProps {
  data: number[];
  trend: "up" | "down" | "neutral";
}

function Sparkline({ data, trend }: SparklineProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 200;
  const height = 40;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y =
      height - ((value - min) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  const color =
    trend === "up"
      ? "#10B981"
      : trend === "down"
      ? "#EF4444"
      : "#6B7280";

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${width - padding},${height} L ${padding},${height} Z`}
        fill={`url(#${gradientId})`}
      />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
