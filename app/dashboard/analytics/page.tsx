"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { RefreshCw, TrendingUp, Users, BarChart, Activity } from "lucide-react";
import { subDays, format } from "date-fns";
import { DateRange } from "react-day-picker";

// Analytics components
import { OverviewMetrics } from "@/components/analytics/OverviewMetrics";
import { TimeSeriesCharts } from "@/components/analytics/TimeSeriesCharts";
import { SequencePerformanceTable } from "@/components/analytics/SequencePerformanceTable";
import { ContactInsights } from "@/components/analytics/ContactInsights";
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap";
import { TrackerPerformance } from "@/components/analytics/TrackerPerformance";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { ExportMenu } from "@/components/analytics/ExportMenu";
import { GoalTracker } from "@/components/analytics/GoalTracker";
import { EmptyAnalytics } from "@/components/EmptyState";
import { showToast } from "@/lib/toast";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  // Analytics data state
  const [overviewData, setOverviewData] = useState<any>(null);
  const [contactsOverTime, setContactsOverTime] = useState<any[]>([]);
  const [sequencePerformance, setSequencePerformance] = useState<any[]>([]);
  const [contactInsights, setContactInsights] = useState<any>(null);
  const [activityHeatmap, setActivityHeatmap] = useState<any[]>([]);
  const [trackerPerformance, setTrackerPerformance] = useState<any>(null);

  const fetchAnalytics = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
      if (compareEnabled) params.set("compareWith", "previous_period");

      // Fetch all analytics data in parallel
      const [overview, contacts, sequences, insights, heatmap, tracker] = await Promise.all([
        fetch(`/api/v1/analytics?metric=overview&${params.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/analytics?metric=contacts_over_time&${params.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/analytics?metric=sequence_performance&${params.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/analytics?metric=contact_insights&${params.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/analytics?metric=activity_heatmap&${params.toString()}`).then((r) => r.json()),
        fetch(`/api/v1/analytics?metric=tracker_performance&${params.toString()}`).then((r) => r.json()),
      ]);

      setOverviewData(overview);
      setContactsOverTime(contacts.data || []);
      setSequencePerformance(sequences.data || []);
      setContactInsights(insights.data || {});
      setActivityHeatmap(heatmap.data || []);
      setTrackerPerformance(tracker.data || null);

      // Check if there's any data
      const hasAnyData =
        (overview.data?.totalContacts ?? 0) > 0 ||
        (contacts.data?.length ?? 0) > 0 ||
        (sequences.data?.length ?? 0) > 0;

      setHasData(hasAnyData);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      showToast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, compareEnabled]);

  const handleRefresh = () => {
    showToast.loading("Refreshing analytics...");
    fetchAnalytics();
  };

  const breadcrumbs = [{ label: "Analytics" }];

  // Show empty state if no data
  if (!loading && !hasData) {
    return (
      <DashboardShell breadcrumbs={breadcrumbs}>
        <EmptyAnalytics />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-fraunces font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track your outreach performance and engagement
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overviewData && (
              <ExportMenu
                data={{
                  overview: overviewData.data,
                  sequences: sequencePerformance,
                  contacts: contactInsights,
                  tracker: trackerPerformance,
                }}
                dateRange={dateRange}
              />
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          compareEnabled={compareEnabled}
          onCompareToggle={setCompareEnabled}
        />

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="sequences" className="gap-2">
              <BarChart className="h-4 w-4" />
              Sequences
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {overviewData && (
              <OverviewMetrics
                data={overviewData.data}
                comparison={overviewData.comparison}
                loading={loading}
              />
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <TimeSeriesCharts contactsData={contactsOverTime} loading={loading} />

              {overviewData && (
                <GoalTracker
                  currentContacts={overviewData.data?.totalContacts || 0}
                  currentEmails={overviewData.data?.emailsSent || 0}
                  currentReplyRate={parseFloat(overviewData.data?.replyRate || "0")}
                />
              )}
            </div>

            <TrackerPerformance data={trackerPerformance} loading={loading} />
          </TabsContent>

          {/* Sequences Tab */}
          <TabsContent value="sequences" className="space-y-6">
            <SequencePerformanceTable data={sequencePerformance} loading={loading} />
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6">
            {contactInsights && (
              <ContactInsights
                topCompanies={contactInsights.topCompanies || []}
                topRoles={contactInsights.topRoles || []}
                sourceBreakdown={contactInsights.sourceBreakdown || []}
                topTags={contactInsights.topTags || []}
                loading={loading}
              />
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityHeatmap data={activityHeatmap} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

