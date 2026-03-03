"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Mail,
  MessageSquare,
  Percent,
  Users,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { showToast } from "@/lib/toast";

type PeriodOption = "7d" | "30d" | "90d" | "all";

type AnalyticsResponse = {
  overview: {
    totalContacts: number;
    totalSent: number;
    totalReplied: number;
    totalBounced: number;
    replyRate: number;
  };
  contactsByStatus: { status: string; count: number }[];
  contactsOverTime: { date: string; count: number }[];
  topCompanies: { company_name: string; count: number }[];
  topRoles: { role: string; count: number }[];
  sequencePerformance: {
    id: string;
    name: string;
    enrolled: number;
    sent: number;
    opened: number;
    replied: number;
    replyRate: number;
  }[];
  previousPeriod?: {
    contacts: number;
    sent: number;
    replied: number;
    replyRate: number;
  };
};

type SequenceSortKey = "name" | "enrolled" | "sent" | "opened" | "replied" | "replyRate";

type SortDirection = "asc" | "desc";

const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const STATUS_COLORS: Record<string, string> = {
  discovered: "#64748b",
  sent: "#2563eb",
  replied: "#16a34a",
  bounced: "#dc2626",
};

const STATUS_LABELS: Record<string, string> = {
  discovered: "Discovered",
  sent: "Sent",
  replied: "Replied",
  bounced: "Bounced",
};

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function TrendIndicator({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return <span className="text-xs text-slate-500">No change</span>;
  }

  const positive = value > 0;

  return (
    <span className={positive ? "inline-flex items-center gap-1 text-xs text-emerald-600" : "inline-flex items-center gap-1 text-xs text-rose-600"}>
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function OverviewCard({
  title,
  value,
  icon: Icon,
  trend,
  empty,
}: {
  title: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  trend: number | null;
  empty: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
          <span>{title}</span>
          <Icon className="h-4 w-4 text-slate-500" />
        </CardDescription>
        <CardTitle className="text-2xl font-semibold text-[#2D2B55]">{empty ? "—" : value}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? <span className="text-xs text-slate-500">No data yet</span> : <TrendIndicator value={trend} />}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodOption>("30d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SequenceSortKey>("replyRate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/analytics/user?period=${period}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AnalyticsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load analytics");
      }

      setData(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load analytics");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const hasData = useMemo(() => {
    if (!data) return false;

    return (
      data.overview.totalContacts > 0 ||
      data.overview.totalSent > 0 ||
      data.overview.totalReplied > 0 ||
      data.sequencePerformance.length > 0
    );
  }, [data]);

  const contactsTrend = useMemo(() => {
    if (!data?.previousPeriod) return null;
    const prev = data.previousPeriod.contacts;
    if (prev <= 0) return null;
    return ((data.overview.totalContacts - prev) / prev) * 100;
  }, [data]);

  const sentTrend = useMemo(() => {
    if (!data?.previousPeriod) return null;
    const prev = data.previousPeriod.sent;
    if (prev <= 0) return null;
    return ((data.overview.totalSent - prev) / prev) * 100;
  }, [data]);

  const repliesTrend = useMemo(() => {
    if (!data?.previousPeriod) return null;
    const prev = data.previousPeriod.replied;
    if (prev <= 0) return null;
    return ((data.overview.totalReplied - prev) / prev) * 100;
  }, [data]);

  const replyRateTrend = useMemo(() => {
    if (!data?.previousPeriod) return null;
    return data.overview.replyRate - data.previousPeriod.replyRate;
  }, [data]);

  const contactsChartData = useMemo(() => {
    return (data?.contactsOverTime ?? []).map((point) => ({
      ...point,
      label: formatShortDate(point.date),
    }));
  }, [data]);

  const statusData = useMemo(() => {
    return (data?.contactsByStatus ?? []).map((item) => ({
      ...item,
      label: STATUS_LABELS[item.status] ?? item.status,
      color: STATUS_COLORS[item.status] ?? "#64748b",
    }));
  }, [data]);

  const topCompanies = useMemo(() => data?.topCompanies ?? [], [data]);

  const sortedSequences = useMemo(() => {
    const rows = [...(data?.sequencePerformance ?? [])];

    rows.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];

      if (typeof left === "string" && typeof right === "string") {
        return sortDirection === "asc"
          ? left.localeCompare(right)
          : right.localeCompare(left);
      }

      const leftNum = Number(left);
      const rightNum = Number(right);

      if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) return 0;

      return sortDirection === "asc" ? leftNum - rightNum : rightNum - leftNum;
    });

    return rows;
  }, [data, sortDirection, sortKey]);

  const toggleSort = (key: SequenceSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("desc");
  };

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <PageHeader
        title="Analytics"
        description="Track contacts, outreach, and sequence performance."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                showToast.info("Coming soon");
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = period === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-[#2D2B55] bg-[#2D2B55] text-white"
                    : "border-slate-200 bg-white text-[#2D2B55] hover:bg-slate-50",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="pt-6">
              <p className="text-sm text-rose-700">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            title="Total Contacts"
            value={formatNumber(data?.overview.totalContacts ?? 0)}
            icon={Users}
            trend={contactsTrend}
            empty={!hasData && !isLoading}
          />
          <OverviewCard
            title="Emails Sent"
            value={data?.overview.totalSent === 0 && !isLoading
              ? "—"
              : formatNumber(data?.overview.totalSent ?? 0)}
            icon={Mail}
            trend={sentTrend}
            empty={!hasData && !isLoading}
          />
          <OverviewCard
            title="Replies"
            value={formatNumber(data?.overview.totalReplied ?? 0)}
            icon={MessageSquare}
            trend={repliesTrend}
            empty={!hasData && !isLoading}
          />
          <OverviewCard
            title="Reply Rate"
            value={data?.overview.totalSent === 0 && !isLoading
              ? "—"
              : formatPercent(data?.overview.replyRate ?? 0)}
            icon={Percent}
            trend={replyRateTrend}
            empty={!hasData && !isLoading}
          />
        </section>

        {!isLoading && !hasData ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600">Start finding emails to see your analytics.</p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contacts Over Time</CardTitle>
              <CardDescription>Cumulative contacts for the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {isLoading ? (
                <div className="h-full animate-pulse rounded-md bg-slate-100" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={contactsChartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#2D2B55"
                      strokeWidth={2}
                      dot={false}
                      name="Contacts"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Status Breakdown</CardTitle>
              <CardDescription>Discovered, sent, replied, and bounced contacts.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {isLoading ? (
                <div className="h-full animate-pulse rounded-md bg-slate-100" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={84}
                      innerRadius={42}
                      label={({ name, value }) => `${String(name ?? "")}: ${value ?? 0}`}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Companies</CardTitle>
              <CardDescription>Top 10 companies by contact count.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {isLoading ? (
                <div className="h-full animate-pulse rounded-md bg-slate-100" />
              ) : topCompanies.length === 0 ? (
                <p className="text-sm text-slate-500">No company data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCompanies.map((item) => ({
                      ...item,
                      label: item.company_name,
                    }))}
                    layout="vertical"
                    margin={{ top: 6, right: 12, left: 4, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2D2B55" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Roles</CardTitle>
              <CardDescription>Top 10 contact roles.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {isLoading ? (
                <div className="h-full animate-pulse rounded-md bg-slate-100" />
              ) : (data?.topRoles?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No role data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data?.topRoles ?? []).map((item) => ({
                      ...item,
                      label: item.role,
                    }))}
                    layout="vertical"
                    margin={{ top: 6, right: 12, left: 4, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2D2B55" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Sequence Performance</CardTitle>
              <CardDescription>Enrollment and engagement metrics by sequence.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("name")}>Sequence Name</button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("enrolled")}>Enrolled</button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("sent")}>Sent</button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("opened")}>Opened</button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("replied")}>Replied</button>
                    </TableHead>
                    <TableHead>
                      <button type="button" className="font-medium text-inherit" onClick={() => toggleSort("replyRate")}>Reply Rate</button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                        Loading sequence performance...
                      </TableCell>
                    </TableRow>
                  ) : sortedSequences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                        Send emails from a sequence to see performance data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSequences.map((sequence) => (
                      <TableRow key={sequence.id}>
                        <TableCell className="font-medium text-[#2D2B55]">{sequence.name}</TableCell>
                        <TableCell>{formatNumber(sequence.enrolled)}</TableCell>
                        <TableCell>{formatNumber(sequence.sent)}</TableCell>
                        <TableCell>{formatNumber(sequence.opened)}</TableCell>
                        <TableCell>{formatNumber(sequence.replied)}</TableCell>
                        <TableCell>{formatPercent(sequence.replyRate)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}

