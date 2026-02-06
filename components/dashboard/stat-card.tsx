"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  description?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  trend = "neutral",
  loading = false,
}: StatCardProps) {
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
              className="text-2xl font-bold"
            >
              {value}
            </motion.div>
            {(change !== undefined || description) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {change !== undefined && (
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
                {description && <span>{description}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
