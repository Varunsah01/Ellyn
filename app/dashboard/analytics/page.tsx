"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MetricCard } from "@/components/analytics/metric-card";
import { LineChart } from "@/components/analytics/line-chart";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { HeatMap } from "@/components/analytics/heat-map";
import { DateRangePicker, DateRange } from "@/components/analytics/date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Mail,
  TrendingUp,
  Zap,
  MessageSquare,
  Eye,
  Download,
  BarChart3,
  Clock,
} from "lucide-react";
import {
  mockAnalyticsOverview,
  mockTimeSeriesData,
  mockFunnelData,
  mockSequencePerformance,
  mockTemplatePerformance,
  mockContactSources,
  mockResponseTimeDistribution,
  mockBestSendTimesData,
  mockCompanyAnalytics,
} from "@/lib/data/mock-analytics";
import { calculateMetricChange, formatPercentage, generateSparklineData } from "@/lib/utils/analytics-calculations";
import { chartColors } from "@/lib/utils/chart-config";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Calculate metrics
  const contactsMetric = calculateMetricChange(
    mockAnalyticsOverview.totalContacts.current,
    mockAnalyticsOverview.totalContacts.previous
  );

  const emailsMetric = calculateMetricChange(
    mockAnalyticsOverview.emailsSent.current,
    mockAnalyticsOverview.emailsSent.previous
  );

  const responseRateMetric = calculateMetricChange(
    mockAnalyticsOverview.responseRate.current,
    mockAnalyticsOverview.responseRate.previous
  );

  const activeSequencesMetric = calculateMetricChange(
    mockAnalyticsOverview.activeSequences.current,
    mockAnalyticsOverview.activeSequences.previous
  );

  const repliesMetric = calculateMetricChange(
    mockAnalyticsOverview.newReplies.current,
    mockAnalyticsOverview.newReplies.previous
  );

  const openRateMetric = calculateMetricChange(
    mockAnalyticsOverview.openRate.current,
    mockAnalyticsOverview.openRate.previous
  );

  // Sparkline data
  const contactsSparkline = generateSparklineData(
    mockTimeSeriesData.map((d) => ({ date: d.date, value: d.contactsAdded }))
  );

  const emailsSparkline = generateSparklineData(
    mockTimeSeriesData.map((d) => ({ date: d.date, value: d.emailsSent }))
  );

  const repliesSparkline = generateSparklineData(
    mockTimeSeriesData.map((d) => ({ date: d.date, value: d.repliesReceived }))
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-fraunces font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track your outreach performance and engagement
            </p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Date Range Picker */}
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          compareEnabled={compareEnabled}
          onCompareChange={setCompareEnabled}
        />

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Total Contacts"
            value={contactsMetric.current}
            change={contactsMetric.change}
            trend={contactsMetric.trend}
            sparklineData={contactsSparkline}
            icon={Users}
            description="Contacts in your database"
          />
          <MetricCard
            title="Emails Sent"
            value={emailsMetric.current}
            change={emailsMetric.change}
            trend={emailsMetric.trend}
            sparklineData={emailsSparkline}
            icon={Mail}
            description="Total outreach emails"
          />
          <MetricCard
            title="Response Rate"
            value={responseRateMetric.current}
            change={responseRateMetric.change}
            trend={responseRateMetric.trend}
            format="percentage"
            icon={TrendingUp}
            description="Contacts who replied"
          />
          <MetricCard
            title="Active Sequences"
            value={activeSequencesMetric.current}
            change={activeSequencesMetric.change}
            trend={activeSequencesMetric.trend}
            icon={Zap}
            description="Running campaigns"
          />
          <MetricCard
            title="New Replies"
            value={repliesMetric.current}
            change={repliesMetric.change}
            trend={repliesMetric.trend}
            sparklineData={repliesSparkline}
            icon={MessageSquare}
            description="Replies this period"
          />
          <MetricCard
            title="Open Rate"
            value={openRateMetric.current}
            change={openRateMetric.change}
            trend={openRateMetric.trend}
            format="percentage"
            icon={Eye}
            description="Emails opened"
          />
        </div>

        {/* Outreach Activity Chart */}
        <LineChart
          title="Outreach Activity"
          description="Track your daily contact additions, emails sent, and replies received"
          data={mockTimeSeriesData}
          xAxisKey="date"
          series={[
            { name: "Contacts Added", dataKey: "contactsAdded", color: chartColors.primary },
            { name: "Emails Sent", dataKey: "emailsSent", color: chartColors.secondary },
            { name: "Replies Received", dataKey: "repliesReceived", color: chartColors.success },
          ]}
          height={350}
        />

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Email Performance Funnel */}
          <FunnelChart
            title="Email Performance Funnel"
            description="Conversion rates at each stage of your outreach"
            stages={mockFunnelData}
          />

          {/* Contact Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Sources</CardTitle>
              <CardDescription>Where your contacts are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockContactSources.map((source, index) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium">{source.source}</span>
                      <span className="text-muted-foreground">
                        {source.count} ({formatPercentage(source.percentage, 1)})
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${source.percentage}%`,
                          backgroundColor: [
                            chartColors.primary,
                            chartColors.secondary,
                            chartColors.success,
                            chartColors.warning,
                          ][index % 4],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sequence Performance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sequence Performance</CardTitle>
                <CardDescription>Performance metrics for all your sequences</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      Sequence Name
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Contacts
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Emails Sent
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Open Rate
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Reply Rate
                    </th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                      Avg. Response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockSequencePerformance.map((seq) => (
                    <tr key={seq.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-medium">{seq.name}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {seq.contactsEnrolled}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {seq.emailsSent}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-green-600 dark:text-green-500">
                          {formatPercentage(seq.openRate, 1)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-blue-600 dark:text-blue-500">
                          {formatPercentage(seq.replyRate, 1)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {seq.avgResponseTime}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Analytics Tabs */}
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="timing">Best Send Times</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="response-time">Response Time</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Performance</CardTitle>
                <CardDescription>
                  See which email templates are performing best
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTemplatePerformance.map((template) => (
                    <div key={template.id} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.sendCount} sends
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-green-600 dark:text-green-500">
                            {formatPercentage(template.openRate, 1)}
                          </p>
                          <p className="text-xs text-muted-foreground">Open</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-blue-600 dark:text-blue-500">
                            {formatPercentage(template.replyRate, 1)}
                          </p>
                          <p className="text-xs text-muted-foreground">Reply</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timing">
            <HeatMap
              title="Best Send Times"
              description="Response rates by day of week and hour (9 AM - 4 PM shown)"
              data={mockBestSendTimesData}
              rowLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
              colLabels={["9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm"]}
              colorScheme="green"
              unit="%"
            />
          </TabsContent>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Company Analysis</CardTitle>
                <CardDescription>
                  Engagement metrics by target company
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                          Company
                        </th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                          Contacts Reached
                        </th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                          Response Rate
                        </th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">
                          Avg. Response Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockCompanyAnalytics.map((company) => (
                        <tr key={company.company} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{company.company}</td>
                          <td className="p-3 text-right text-muted-foreground">
                            {company.contactsReached}
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-green-600 dark:text-green-500">
                              {formatPercentage(company.responseRate, 1)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {company.avgResponseTime}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="response-time">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
                <CardDescription>
                  How quickly contacts are responding to your outreach
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockResponseTimeDistribution.map((bucket, index) => {
                    const maxCount = Math.max(...mockResponseTimeDistribution.map((b) => b.count));
                    const percentage = (bucket.count / maxCount) * 100;

                    return (
                      <div key={bucket.bucket}>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{bucket.bucket}</span>
                          </div>
                          <span className="text-muted-foreground">{bucket.count} responses</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
