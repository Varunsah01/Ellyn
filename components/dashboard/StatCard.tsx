"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  description?: string;
  emptyMessage?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

/**
 * Render the StatCard component.
 * @param {StatCardProps} props - Component props.
 * @returns {unknown} JSX output for StatCard.
 * @example
 * <StatCard />
 */
export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  emptyMessage,
  trend = "neutral",
  loading = false,
}: StatCardProps) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  const isZeroValue =
    !loading && Number.isFinite(numericValue) && numericValue === 0;
  const helperText = isZeroValue ? emptyMessage || description : description;
  const showChange =
    !isZeroValue && typeof change === "number" && change > 0;
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "text-2xl font-bold",
                isZeroValue && "text-muted-foreground"
              )}
            >
              {value}
            </motion.div>
            {(showChange || helperText) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {showChange && (
                  <span
                    className={cn(
                      "flex items-center gap-1 font-medium",
                      isPositive && "text-green-600 dark:text-green-400",
                      isNegative && "text-red-600 dark:text-red-400"
                    )}
                  >
                    {isPositive && <ArrowUp className="h-3 w-3" />}
                    {isNegative && <ArrowDown className="h-3 w-3" />}
                    {Math.abs(change)}%
                  </span>
                )}
                {helperText && <span>{helperText}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
