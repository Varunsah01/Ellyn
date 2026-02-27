"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { Button } from "@/components/ui/Button";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Users,
  Mail,
  Zap,
  Plus,
  RefreshCw,
  CheckCircle2,
  Circle,
  Target,
  Search,
  FileText,
  Rocket,
  Briefcase,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRecentActivity } from "@/lib/hooks/useAnalytics";
import { useTopSequences } from "@/lib/hooks/useSequences";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeContacts } from "@/hooks/useRealtimeContacts";
import { SmartQuickActions } from "@/components/ContextualActions";
import { usePersona } from "@/context/PersonaContext";
import { getPersonaCopy, type Persona } from "@/lib/persona-copy";

const PERSONA_BANNER_DISMISSED_KEY = "ellyn_persona_banner_dismissed";

function readPersonaBannerDismissed(): Partial<Record<Persona, boolean>> {
  try {
    const raw = localStorage.getItem(PERSONA_BANNER_DISMISSED_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return parsed as Partial<Record<Persona, boolean>>;
  } catch {
    return {};
  }
}

function writePersonaBannerDismissed(value: Partial<Record<Persona, boolean>>) {
  try {
    localStorage.setItem(PERSONA_BANNER_DISMISSED_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable
  }
}

export default function DashboardPage() {
  const { persona, isJobSeeker } = usePersona();
  const copy = getPersonaCopy(persona);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [isPersonaBannerDismissed, setIsPersonaBannerDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const resolveUser = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionData.session?.user?.id) {
          setUserId(sessionData.session.user.id);
        }

        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (error || !data.user) {
          setUserId(null);
          return;
        }

        setUserId(data.user.id);
      } finally {
        if (isMounted) {
          setUserLoading(false);
        }
      }
    };

    void resolveUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUserId(session?.user?.id ?? null);
      setUserLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const { metrics, loading: metricsLoading, refresh: refreshMetrics } = useDashboardMetrics(userId);
  const { activities, loading: activityLoading, refresh: refreshActivity } = useRecentActivity(10);
  const {
    contacts: realtimeContacts,
    loading: contactsLoading,
    isLive: contactsLive,
    refresh: refreshContacts,
  } = useRealtimeContacts(userId, 50);
  const { sequences: topSequences, loading: seqLoading } = useTopSequences(3);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  const isLoading = userLoading || metricsLoading || activityLoading || contactsLoading || seqLoading;
  const metricCardsLoading = userLoading || metricsLoading;
  const hasNoWeeklyProgress =
    metrics.newContactsThisWeek === 0 &&
    metrics.emailsSentThisWeek === 0;

  const formattedRecentContacts = useMemo(
    () =>
      [...realtimeContacts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((contact) => {
          const fullName =
            contact.full_name?.trim() ||
            `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
            "Unknown Contact";

          return {
            id: contact.id,
            name: fullName,
            company: contact.company || "Unknown",
            email: contact.confirmed_email || contact.inferred_email || "",
            addedAt: new Date(contact.created_at),
          };
        }),
    [realtimeContacts]
  );

  const nextSteps = [
    {
      key: "contacts",
      title: copy.nextStepContactsTitle,
      description: copy.nextStepContactsDesc,
      completed: metrics.totalContacts > 0,
      href: "/dashboard/contacts",
      cta: copy.nextStepContactsCTA,
    },
    {
      key: "templates",
      title: copy.nextStepTemplatesTitle,
      description: copy.nextStepTemplatesDesc,
      completed: metrics.emailTemplates > 0,
      href: "/dashboard/templates",
      cta: copy.nextStepTemplatesCTA,
    },
  ];

  const completedSteps = nextSteps.filter((step) => step.completed).length;
  const SequenceQuickActionIcon: LucideIcon =
    copy.quickActionSequenceIcon === "rocket" ? Rocket : Mail;

  const quickActions: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
  }> = [
    {
      key: "find_email",
      title: copy.quickActionFindEmail,
      description: copy.quickActionFindEmailDesc,
      href: "/dashboard/contacts",
      icon: Search,
    },
    {
      key: "browse_templates",
      title: copy.quickActionBrowseTemplates,
      description: copy.quickActionBrowseTemplatesDesc,
      href: copy.quickActionTemplatesHref,
      icon: FileText,
    },
    {
      key: "start_sequence",
      title: copy.quickActionStartSequence,
      description: copy.quickActionStartSequenceDesc,
      href: "/dashboard/sequences/new",
      icon: SequenceQuickActionIcon,
    },
  ];

  const PersonaModeIcon: LucideIcon = isJobSeeker ? Briefcase : TrendingUp;
  const personaBannerClassName = isJobSeeker
    ? "border-violet-200 bg-violet-50 text-violet-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const personaBannerIconClassName = isJobSeeker
    ? "text-violet-600"
    : "text-emerald-600";

  // Handle refresh all data
  const handleRefreshAll = async () => {
    await Promise.all([refreshMetrics(), refreshActivity(), refreshContacts()]);
  };

  useEffect(() => {
    const dismissedByPersona = readPersonaBannerDismissed();
    setIsPersonaBannerDismissed(Boolean(dismissedByPersona[persona]));
  }, [persona]);

  const dismissPersonaBanner = () => {
    setIsPersonaBannerDismissed(true);
    const dismissedByPersona = readPersonaBannerDismissed();
    dismissedByPersona[persona] = true;
    writePersonaBannerDismissed(dismissedByPersona);
  };

  const extensionUrl =
    process.env.NEXT_PUBLIC_EXTENSION_URL ?? "https://chromewebstore.google.com";

  return (
    <DashboardShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={persona}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Smart Quick Actions - show contextual CTAs based on state */}
          <SmartQuickActions
            totalContacts={metrics.totalContacts}
            totalSequences={metrics.emailTemplates}
          />

          {/* Welcome Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-fraunces font-bold">{greeting}!</h1>
              <p className="text-muted-foreground mt-1">
                {copy.dashboardSubtitle} &middot;{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button asChild>
                <Link href="/dashboard/contacts">
                  <Plus className="mr-2 h-4 w-4" />
                  {copy.addContactCTA}
                </Link>
              </Button>
            </div>
          </div>

          {!isPersonaBannerDismissed ? (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${personaBannerClassName}`}
            >
              <PersonaModeIcon
                className={`h-4 w-4 shrink-0 ${personaBannerIconClassName}`}
              />
              <p className="flex-1">{copy.personaBannerText}</p>
              <button
                type="button"
                onClick={dismissPersonaBanner}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/5"
                aria-label="Dismiss persona banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <AnimatedCard
            className="border-primary/20 bg-primary/5"
            data-tour="extension"
            hoverScale={1.01}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Quick start: Install the Chrome extension
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">{copy.extensionCTA}</p>
              <div className="flex items-center gap-2">
                <Button asChild>
                  <a href={extensionUrl} target="_blank" rel="noreferrer">
                    Get Extension
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/contacts">View {copy.contacts}</Link>
                </Button>
              </div>
            </CardContent>
          </AnimatedCard>

          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Recommended Next Steps</CardTitle>
                <Badge
                  variant={
                    completedSteps === nextSteps.length ? "secondary" : "outline"
                  }
                >
                  {completedSteps}/{nextSteps.length} complete
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextSteps.map((step) => (
                <div
                  key={step.key}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200/70 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    {step.completed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {step.title}
                      </p>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                  </div>
                  <Button
                    variant={step.completed ? "outline" : "default"}
                    size="sm"
                    asChild
                  >
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                </div>
              ))}
              {completedSteps === nextSteps.length ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Your workspace is set up. Keep your contact statuses updated to
                  improve follow-up timing.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{copy.quickActionsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <div
                    key={action.key}
                    className="rounded-lg border border-slate-200/70 bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {action.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <Button className="mt-3 w-full" variant="outline" size="sm" asChild>
                      <Link href={action.href}>{action.title}</Link>
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Activity Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Week&apos;s Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                  </div>
                ) : hasNoWeeklyProgress ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground">
                    <p>{copy.weeklyProgressEmpty}</p>
                    <Link
                      href="/dashboard/contacts"
                      className="mt-2 inline-block font-medium text-primary hover:underline"
                    >
                      {copy.nextStepContactsCTA}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{copy.contacts} added</span>
                      <span className="font-bold">{metrics.newContactsThisWeek}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Emails sent</span>
                      <span className="font-bold">{metrics.emailsSentThisWeek}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Response rate</span>
                      <span className="font-bold">
                        {metrics.emailsSent > 0
                          ? `${metrics.responseRate}%`
                          : copy.statsEmailsNoDataLabel}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <StatCard
              title={copy.statsContactsLabel}
              value={metricCardsLoading ? 0 : metrics.totalContacts}
              icon={Users}
              description={`${metrics.newContactsThisWeek} added this week`}
              emptyMessage={copy.statsContactsEmptyMessage}
              loading={metricCardsLoading}
            />

            <StatCard
              title={copy.statsDiscoveredLabel}
              value={metricCardsLoading ? 0 : metrics.discoveredLeads}
              icon={Target}
              description={`${copy.contacts} added from extension`}
              emptyMessage={copy.statsDiscoveredEmptyMessage}
              loading={metricCardsLoading}
            />

            <StatCard
              title={copy.statsTemplatesLabel}
              value={metricCardsLoading ? 0 : metrics.emailTemplates}
              icon={Zap}
              description="Reusable outreach templates"
              emptyMessage={copy.statsTemplatesEmptyMessage}
              loading={metricCardsLoading}
            />

            <StatCard
              title={copy.statsEmailsLabel}
              value={metricCardsLoading ? 0 : metrics.emailsSent}
              {...(metrics.emailsSentThisWeek > 0
                ? { change: metrics.emailsSentThisWeek, trend: "up" as const }
                : {})}
              icon={Mail}
              description={
                metrics.emailsSent > 0
                  ? `${metrics.responseRate}% response rate`
                  : copy.statsEmailsEmptyMessage
              }
              emptyMessage={copy.statsEmailsEmptyMessage}
              loading={metricCardsLoading}
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
                topSequences={topSequences}
                loading={seqLoading}
                contactsLoading={contactsLoading}
                contactsLive={contactsLive}
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </DashboardShell>
  );
}
