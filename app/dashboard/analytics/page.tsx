"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { subDays, format } from "date-fns"
import { DateRange } from "react-day-picker"
import {
  Briefcase,
  Mail,
  MessageSquare,
  Clock,
  Users,
  TrendingUp,
  BarChart2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { ArrowUp, ArrowDown } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter"
import { ExportMenu } from "@/components/analytics/ExportMenu"
import { OverviewMetrics } from "@/components/analytics/OverviewMetrics"
import { OutreachFunnel } from "@/components/analytics/OutreachFunnel"
import { SequencePerformanceTable } from "@/components/analytics/SequencePerformanceTable"
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap"
import { TimeSeriesCharts } from "@/components/analytics/TimeSeriesCharts"
import { ContactInsights } from "@/components/analytics/ContactInsights"
import { usePersona } from "@/context/PersonaContext"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totalContacts: number
  totalDrafts: number
  emailsSent: number
  replyRate: string | null
  bestPerformingSequence: string | null
  bestPerformingReplyRate: string | null
  mostActiveDay: string | null
  mostActiveHour: string | null
}

interface ComparisonData {
  contacts: number
  drafts: number
  emailsSent: number
  replyRate: number
}

interface SequenceRow {
  id: string
  name: string
  enrolled: number
  sent: number
  opened: number
  replied: number
  replyRate: number
  openRate: number
  status?: string
}

interface ContactsTimePoint {
  date: string
  count: number
  label: string
}

interface ContactInsightsData {
  topCompanies: { name: string; count: number }[]
  topRoles: { name: string; count: number }[]
  sourceBreakdown: { source: string; count: number; percentage: string }[]
  topTags: { name: string; count: number }[]
}

interface HeatmapPoint {
  day: number
  hour: number
  count: number
}

interface UserAnalytics {
  outreach: {
    totalSent: number
    openRate: number
    replyRate: number
    avgResponseDays: number
  }
  sequences: {
    active: number
    totalEnrolled: number
    completionRate: number
    topPerforming: { id: string; name: string; replyRate: number }[]
  }
  contactGrowth: { date: string; count: number }[]
  activityHeatmap: HeatmapPoint[]
  totalContacts: number
  applicationsTracked: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function transformHeatmap(flat: HeatmapPoint[]) {
  return DAY_LABELS.map((day, dayIndex) => ({
    day,
    dayIndex,
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: flat.find((p) => p.day === dayIndex && p.hour === hour)?.count ?? 0,
    })),
  }))
}

function rangeToParams(range: DateRange | undefined) {
  if (!range?.from) {
    const start = subDays(new Date(), 30)
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }
  }
  return {
    startDate: format(range.from, "yyyy-MM-dd"),
    endDate: format(range.to ?? range.from, "yyyy-MM-dd"),
  }
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  trend?: { value: number; isPositive: boolean }
  loading?: boolean
}

function KpiCard({ title, value, icon: Icon, description, trend, loading }: KpiCardProps) {
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
            <div className="text-2xl font-bold">{value}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    trend.isPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
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
  )
}

// ─── Inner page (needs useSearchParams) ───────────────────────────────────────

function AnalyticsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { persona, isJobSeeker } = usePersona()

  // ── Date range state ──────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const range = searchParams.get("range") ?? "30d"
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30
    return { from: subDays(new Date(), days), to: new Date() }
  })
  const [compareEnabled, setCompareEnabled] = useState(false)

  // Sync date range changes to URL
  const handleRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range)
      const params = new URLSearchParams(searchParams.toString())
      if (!range) {
        params.delete("range")
      } else {
        const days = range.to && range.from
          ? Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000)
          : 30
        params.set("range", `${days}d`)
      }
      router.replace(`/dashboard/analytics?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // ── Fetch state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [sequences, setSequences] = useState<SequenceRow[]>([])
  const [contactsTime, setContactsTime] = useState<ContactsTimePoint[]>([])
  const [contactInsights, setContactInsights] = useState<ContactInsightsData | null>(null)
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null)

  // ── Fetch all data ────────────────────────────────────────────────────────
  const { startDate, endDate } = useMemo(() => rangeToParams(dateRange), [dateRange])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const qs = `startDate=${startDate}&endDate=${endDate}`
      const compareQs = compareEnabled ? `&compareWith=previous_period` : ""

      const [overviewRes, seqRes, contactsTimeRes, insightsRes, userRes] = await Promise.all([
        fetch(`/api/analytics?metric=overview&${qs}${compareQs}`),
        fetch(`/api/analytics?metric=sequence_performance&${qs}`),
        fetch(`/api/analytics?metric=contacts_over_time&${qs}`),
        fetch(`/api/analytics?metric=contact_insights&${qs}`),
        fetch(`/api/v1/analytics/user?startDate=${startDate}&endDate=${endDate}`),
      ])

      const [overviewJson, seqJson, contactsTimeJson, insightsJson, userJson] =
        await Promise.all([
          overviewRes.ok ? overviewRes.json() : null,
          seqRes.ok ? seqRes.json() : null,
          contactsTimeRes.ok ? contactsTimeRes.json() : null,
          insightsRes.ok ? insightsRes.json() : null,
          userRes.ok ? userRes.json() : null,
        ])

      if (overviewJson?.data) setOverviewData(overviewJson.data as OverviewData)
      if (overviewJson?.comparison) setComparison(overviewJson.comparison as ComparisonData)
      if (Array.isArray(seqJson?.data)) setSequences(seqJson.data as SequenceRow[])
      if (Array.isArray(contactsTimeJson?.data)) setContactsTime(contactsTimeJson.data as ContactsTimePoint[])
      if (insightsJson?.data) setContactInsights(insightsJson.data as ContactInsightsData)
      if (userJson && !userJson.error) setUserAnalytics(userJson as UserAnalytics)
    } catch (err) {
      console.error("[Analytics page] fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, compareEnabled])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ── Derived values ────────────────────────────────────────────────────────
  const heatmapData = useMemo(
    () => transformHeatmap(userAnalytics?.activityHeatmap ?? []),
    [userAnalytics]
  )

  // Persona-aware KPI values
  const kpiCards: KpiCardProps[] = useMemo(() => {
    const ua = userAnalytics
    const ov = overviewData
    if (isJobSeeker) {
      return [
        {
          title: "Applications Tracked",
          value: ua?.applicationsTracked ?? 0,
          icon: Briefcase,
          description: "Contacts in progress",
          loading,
        },
        {
          title: "Emails Sent",
          value: ua?.outreach.totalSent ?? ov?.emailsSent ?? 0,
          icon: Mail,
          description: "Total outreach sent",
          loading,
        },
        {
          title: "Response Rate",
          value: ua?.outreach.replyRate != null
            ? `${ua.outreach.replyRate.toFixed(1)}%`
            : ov?.replyRate != null
            ? `${ov.replyRate}%`
            : "—",
          icon: MessageSquare,
          description: "Of sent emails",
          loading,
        },
        {
          title: "Avg Days to Reply",
          value: ua?.outreach.avgResponseDays != null && ua.outreach.avgResponseDays > 0
            ? `${ua.outreach.avgResponseDays.toFixed(1)}d`
            : "—",
          icon: Clock,
          description: "Average response time",
          loading,
        },
      ]
    }
    // SMB Sales persona
    return [
      {
        title: "Total Leads",
        value: ua?.totalContacts ?? ov?.totalContacts ?? 0,
        icon: Users,
        description: "Contacts in database",
        loading,
      },
      {
        title: "Emails Sent",
        value: ua?.outreach.totalSent ?? ov?.emailsSent ?? 0,
        icon: Mail,
        description: "Total outreach sent",
        loading,
      },
      {
        title: "Open Rate",
        value: ua?.outreach.openRate != null
          ? `${ua.outreach.openRate.toFixed(1)}%`
          : "—",
        icon: TrendingUp,
        description: "Of sent emails",
        loading,
      },
      {
        title: "Reply Rate",
        value: ua?.outreach.replyRate != null
          ? `${ua.outreach.replyRate.toFixed(1)}%`
          : ov?.replyRate != null
          ? `${ov.replyRate}%`
          : "—",
        icon: BarChart2,
        description: "Of sent emails",
        loading,
      },
    ]
  }, [isJobSeeker, userAnalytics, overviewData, loading])

  // Export data shape for ExportMenu
  const exportData = useMemo(() => ({
    overview: overviewData ?? {
      totalContacts: 0,
      totalDrafts: 0,
      emailsSent: 0,
      replyRate: null,
      bestPerformingSequence: null,
    },
    sequences,
    contacts: contactInsights ?? {},
  }), [overviewData, sequences, contactInsights])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col gap-4 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {isJobSeeker
                ? "Track your job search outreach performance"
                : "Monitor your sales campaign metrics"}
            </p>
          </div>
          <ExportMenu data={exportData} dateRange={dateRange} />
        </div>

        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={handleRangeChange}
          compareEnabled={compareEnabled}
          onCompareToggle={setCompareEnabled}
        />
      </div>

      <div className="space-y-8">
        {/* Persona-aware KPI row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KpiCard key={card.title} {...card} />
          ))}
        </div>

        {/* Overview metrics */}
        {overviewData && (
          <OverviewMetrics
            data={overviewData}
            comparison={compareEnabled ? comparison : null}
            loading={loading}
          />
        )}
        {loading && !overviewData && (
          <OverviewMetrics
            data={{
              totalContacts: 0,
              totalDrafts: 0,
              emailsSent: 0,
              replyRate: null,
              bestPerformingSequence: null,
              bestPerformingReplyRate: null,
              mostActiveDay: null,
              mostActiveHour: null,
            }}
            loading
          />
        )}

        {/* Outreach funnel */}
        <OutreachFunnel
          contactsFound={userAnalytics?.totalContacts ?? overviewData?.totalContacts ?? 0}
          emailsSent={userAnalytics?.outreach.totalSent ?? overviewData?.emailsSent ?? 0}
          opened={Math.round(
            ((userAnalytics?.outreach.openRate ?? 0) / 100) *
              (userAnalytics?.outreach.totalSent ?? overviewData?.emailsSent ?? 0)
          )}
          clicked={0}
          replied={Math.round(
            ((userAnalytics?.outreach.replyRate ?? 0) / 100) *
              (userAnalytics?.outreach.totalSent ?? overviewData?.emailsSent ?? 0)
          )}
          loading={loading}
        />

        {/* Contact growth + Email trend side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TimeSeriesCharts
            contactsData={contactsTime}
            loading={loading}
          />
          <ActivityHeatmap data={heatmapData} loading={loading} />
        </div>

        {/* Sequence performance */}
        <SequencePerformanceTable
          data={sequences}
          loading={loading}
          persona={persona}
        />

        {/* Contact insights */}
        {contactInsights ? (
          <ContactInsights
            topCompanies={contactInsights.topCompanies}
            topRoles={contactInsights.topRoles}
            sourceBreakdown={contactInsights.sourceBreakdown}
            topTags={contactInsights.topTags}
            loading={loading}
          />
        ) : (
          <ContactInsights
            topCompanies={[]}
            topRoles={[]}
            sourceBreakdown={[]}
            topTags={[]}
            loading={loading}
          />
        )}
      </div>
    </DashboardShell>
  )
}

// ─── Page export (Suspense boundary for useSearchParams) ──────────────────────

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </DashboardShell>
      }
    >
      <AnalyticsPageInner />
    </Suspense>
  )
}
