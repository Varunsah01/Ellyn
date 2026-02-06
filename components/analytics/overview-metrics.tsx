"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, TrendingUp, Zap, Clock, Calendar, ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

function MetricCard({ title, value, icon: Icon, description, trend, loading }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 w-24 rounded bg-muted" />
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}
                >
                  {trend.isPositive ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              )}
              <span>{description}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface OverviewMetricsProps {
  data: {
    totalContacts: number;
    totalDrafts: number;
    emailsSent: number;
    replyRate: string;
    bestPerformingSequence: string;
    bestPerformingReplyRate: string;
    mostActiveDay: string;
    mostActiveHour: string;
  };
  comparison?: {
    contacts: number;
    drafts: number;
    emailsSent: number;
    replyRate: number;
  } | null;
  loading?: boolean;
}

export function OverviewMetrics({ data, comparison, loading }: OverviewMetricsProps) {
  const getTrend = (current: number, change: number) => {
    if (!change || current === 0) return undefined;
    const percentage = (change / (current - change)) * 100;
    return {
      value: percentage,
      isPositive: change > 0,
    };
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Contacts"
        value={data.totalContacts}
        icon={Users}
        description="Contacts in database"
        trend={comparison ? getTrend(data.totalContacts, comparison.contacts) : undefined}
        loading={loading}
      />

      <MetricCard
        title="Total Drafts"
        value={data.totalDrafts}
        icon={Mail}
        description="Drafts created"
        trend={comparison ? getTrend(data.totalDrafts, comparison.drafts) : undefined}
        loading={loading}
      />

      <MetricCard
        title="Emails Sent"
        value={data.emailsSent}
        icon={TrendingUp}
        description="Total emails sent"
        trend={comparison ? getTrend(data.emailsSent, comparison.emailsSent) : undefined}
        loading={loading}
      />

      <MetricCard
        title="Reply Rate"
        value={`${data.replyRate}%`}
        icon={Zap}
        description="Of sent emails"
        trend={comparison ? {
          value: comparison.replyRate,
          isPositive: comparison.replyRate > 0
        } : undefined}
        loading={loading}
      />

      <Card className="col-span-full md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Best Performing Sequence</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-6 w-48 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">{data.bestPerformingSequence}</div>
              <p className="text-sm text-muted-foreground">
                {data.bestPerformingReplyRate}% reply rate
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <MetricCard
        title="Most Active Day"
        value={data.mostActiveDay}
        icon={Calendar}
        description="Peak activity day"
        loading={loading}
      />

      <MetricCard
        title="Most Active Hour"
        value={data.mostActiveHour}
        icon={Clock}
        description="Peak activity time"
        loading={loading}
      />
    </div>
  );
}
