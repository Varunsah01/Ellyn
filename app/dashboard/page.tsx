"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Mail, TrendingUp, Zap, Plus, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useDashboardStats, useRecentActivity } from "@/lib/hooks/useAnalytics";
import { useContacts } from "@/lib/hooks/useContacts";
import { useSequenceStats } from "@/lib/hooks/useSequences";
import { SmartQuickActions } from "@/components/contextual-actions";

export default function DashboardPage() {
  // Fetch real data
  const { stats: dashboardStats, loading: statsLoading, refresh: refreshStats } = useDashboardStats();
  const { activities, loading: activityLoading, refresh: refreshActivity } = useRecentActivity(10);
  const { contacts: recentContacts, loading: contactsLoading } = useContacts({ limit: 5 });
  const { stats: sequenceStats, loading: sequenceLoading } = useSequenceStats();

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const isLoading = statsLoading || activityLoading || contactsLoading || sequenceLoading;

  // Format recent contacts for QuickStats
  const formattedRecentContacts = recentContacts.map((c) => ({
    id: c.id,
    name: c.full_name,
    company: c.company || 'Unknown',
    email: c.confirmed_email || c.inferred_email || '',
    addedAt: new Date(c.created_at),
  }));

  // Mock top sequences (will be replaced when sequence analytics are implemented)
  const mockTopSequences = [
    { id: "1", name: "Software Engineer Outreach", replyRate: 34.2, contactsEnrolled: 45 },
    { id: "2", name: "Product Manager Referral", replyRate: 42.8, contactsEnrolled: 12 },
    { id: "3", name: "Alumni Network", replyRate: 38.5, contactsEnrolled: 18 },
  ];

  // Calculate weekly goal progress (based on new contacts this week)
  const weeklyGoal = 30; // Target: 30 new contacts per week
  const weeklyProgress = dashboardStats.newContactsThisWeek > 0
    ? Math.min((dashboardStats.newContactsThisWeek / weeklyGoal) * 100, 100)
    : 0;

  // Handle refresh all data
  const handleRefreshAll = async () => {
    await Promise.all([refreshStats(), refreshActivity()]);
  };

  const extensionUrl =
    process.env.NEXT_PUBLIC_EXTENSION_URL ?? "https://chromewebstore.google.com";

  return (
    <DashboardShell>
      {/* Smart Quick Actions - show contextual CTAs based on state */}
      <SmartQuickActions
        totalContacts={dashboardStats.totalContacts}
        totalSequences={sequenceStats.totalTemplates}
        totalDrafts={sequenceStats.pendingDrafts}
        className="mb-6"
      />

      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-fraunces font-bold">{greeting}!</h1>
            <p className="text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/dashboard/contacts">
                <Plus className="mr-2 h-4 w-4" />Add Contact
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/compose">Create Draft</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />Analytics
              </Link>
            </Button>
          </div>
        </div>

        <AnimatedCard className="border-primary/20 bg-primary/5" data-tour="extension" hoverScale={1.01}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick start: Install the Chrome extension</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Visit any LinkedIn profile and click the Ellyn extension to capture contacts instantly.
            </p>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href={extensionUrl} target="_blank" rel="noreferrer">
                  Get Extension
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/contacts">View Contacts</Link>
              </Button>
            </div>
          </CardContent>
        </AnimatedCard>

        {/* Activity Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week's Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Contacts added</span>
                    <span className="font-bold">{dashboardStats.newContactsThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Emails sent</span>
                    <span className="font-bold">{dashboardStats.emailsSentThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Response rate</span>
                    <span className="font-bold">{dashboardStats.responseRate}%</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Weekly Goal</span>
                      <span>{Math.round(weeklyProgress)}%</span>
                    </div>
                    <Progress value={weeklyProgress} className="h-2" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <StatCard
            title="Total Contacts"
            value={statsLoading ? 0 : dashboardStats.totalContacts}
            icon={Users}
            description={`${dashboardStats.newContactsThisWeek} added this week`}
            loading={statsLoading}
          />

          <StatCard
            title="Email Templates"
            value={sequenceLoading ? 0 : sequenceStats.totalTemplates}
            icon={Zap}
            description={`${sequenceStats.pendingDrafts} pending drafts`}
            loading={sequenceLoading}
          />

          <StatCard
            title="Emails Sent"
            value={statsLoading ? 0 : dashboardStats.emailsSent}
            change={dashboardStats.emailsSentThisWeek}
            trend="up"
            icon={Mail}
            description={`${dashboardStats.responseRate}% response rate`}
            loading={statsLoading}
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Activity Feed - 2/3 width */}
          <div className="md:col-span-2">
            <ActivityFeed
              activities={activities}
              hasMore={false}
              loading={activityLoading}
            />
          </div>

          {/* Quick Stats - 1/3 width */}
          <div className="space-y-6">
            <QuickStats
              recentContacts={formattedRecentContacts}
              topSequences={mockTopSequences}
              loading={contactsLoading}
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
