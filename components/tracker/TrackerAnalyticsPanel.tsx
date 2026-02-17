"use client";

import { BarChart3, Clock3, TrendingUp } from "lucide-react";
import type { TrackerAnalyticsData } from "@/lib/tracker-v2";

interface TrackerAnalyticsPanelProps {
  analytics: TrackerAnalyticsData;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;

  const width = 180;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" aria-hidden>
      <polyline fill="none" stroke="#FF7B7B" strokeWidth="2" points={points} />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  progress,
}: {
  title: string;
  value: string;
  subtitle?: string;
  progress?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      {typeof progress === "number" ? (
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-1.5 rounded-full bg-[#FF7B7B] transition-all"
            style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Render the TrackerAnalyticsPanel component.
 * @param {TrackerAnalyticsPanelProps} props - Component props.
 * @returns {unknown} JSX output for TrackerAnalyticsPanel.
 * @example
 * <TrackerAnalyticsPanel />
 */
export function TrackerAnalyticsPanel({ analytics }: TrackerAnalyticsPanelProps) {
  const maxTrendRate = Math.max(1, ...analytics.replyTrend.map((item) => item.replyRate));
  const trendValues = analytics.replyTrend.map((item) => item.replyRate);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#FF7B7B]" />
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Analytics</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Reply Rate"
          value={`${analytics.replyRate}%`}
          subtitle="Replied / sent"
          progress={analytics.replyRate}
        />
        <MetricCard
          title="Avg Response Time"
          value={analytics.averageResponseHours == null ? "-" : `${analytics.averageResponseHours}h`}
        />
        <MetricCard title="Drafted" value={`${analytics.funnel.drafted}`} />
        <MetricCard
          title="Sent -> Replied"
          value={`${analytics.funnel.sent} -> ${analytics.funnel.replied}`}
          progress={analytics.funnel.sent > 0 ? (analytics.funnel.replied / analytics.funnel.sent) * 100 : 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reply trend (7 days)</h3>
          </div>
          <Sparkline values={trendValues} />
          <div className="mt-2 space-y-2">
            {analytics.replyTrend.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.label}</span>
                  <span>{item.replyRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-[#FF7B7B]"
                    style={{ width: `${Math.max(6, (item.replyRate / maxTrendRate) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Best performing companies</h3>
          <div className="space-y-2">
            {analytics.bestCompanies.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Not enough data yet.</p>
            ) : (
              analytics.bestCompanies.map((item) => (
                <div key={item.company} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-200">{item.company}</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {item.replyRate}% ({item.replied}/{item.sent})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Best outreach windows</h3>
          </div>
          <div className="space-y-2">
            {analytics.bestOutreachWindows.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No sent-mail data yet.</p>
            ) : (
              analytics.bestOutreachWindows.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.replyRate}% ({item.replied}/{item.sent})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
