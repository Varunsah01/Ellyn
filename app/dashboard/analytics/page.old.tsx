"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Users, Mail, TrendingUp, RefreshCw } from "lucide-react";
import { useAnalytics, useDashboardStats } from "@/lib/hooks/useAnalytics";

export default function AnalyticsPage() {
  const { analytics, loading: analyticsLoading, refresh: refreshAnalytics } = useAnalytics();
  const { stats, loading: statsLoading, refresh: refreshStats } = useDashboardStats();

  const isLoading = analyticsLoading || statsLoading;

  const handleRefreshAll = async () => {
    await Promise.all([refreshAnalytics(), refreshStats()]);
  };

  const breadcrumbs = [
    { label: "Analytics" }
  ];

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
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalContacts}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats.newContactsThisWeek} this week
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.emailsSent}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats.emailsSentThisWeek} this week
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.responseRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Of contacted leads
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalSequences}</div>
                  <p className="text-xs text-muted-foreground">
                    Email templates
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contacts by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-8 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">New</span>
                  </div>
                  <span className="text-sm font-bold">{analytics.contactsByStatus.new}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Contacted</span>
                  </div>
                  <span className="text-sm font-bold">{analytics.contactsByStatus.contacted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Replied</span>
                  </div>
                  <span className="text-sm font-bold">{analytics.contactsByStatus.replied}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="text-sm">No Response</span>
                  </div>
                  <span className="text-sm font-bold">{analytics.contactsByStatus.no_response}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Companies */}
        <Card>
          <CardHeader>
            <CardTitle>Top Companies</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-6 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : analytics.topCompanies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No company data available yet
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.topCompanies.map((company, index) => (
                  <div key={company.company} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium">{company.company}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {company.count} contact{company.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Activity (Last 7 Days) */}
        <Card>
          <CardHeader>
            <CardTitle>Email Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-10 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {analytics.emailsByDay.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-24">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <div className="flex-1 flex gap-2">
                      <div
                        className="bg-blue-500 h-8 rounded flex items-center justify-center text-xs text-white"
                        style={{ width: `${Math.max((day.sent / 10) * 100, 5)}%` }}
                      >
                        {day.sent > 0 && `${day.sent} sent`}
                      </div>
                      <div
                        className="bg-green-500 h-8 rounded flex items-center justify-center text-xs text-white"
                        style={{ width: `${Math.max((day.replied / 10) * 100, 5)}%` }}
                      >
                        {day.replied > 0 && `${day.replied} replied`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
