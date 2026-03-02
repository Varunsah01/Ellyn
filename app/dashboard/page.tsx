"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Copy,
  FileText,
  GitBranch,
  Loader2,
  Search,
  Target,
  Users,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PersonaOnboardingModal } from "@/components/dashboard/PersonaOnboardingModal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { usePersona } from "@/context/PersonaContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { getPersonaCopy, type Persona } from "@/lib/persona-copy";
import { showToast } from "@/lib/toast";

type DashboardAnalytics = {
  totalContacts: number;
  totalSent: number;
  totalReplied: number;
  replyRate: number;
  periodComparison: {
    contacts: number;
    sent: number;
  };
  previousPeriod?: {
    contacts: number;
    sent: number;
    replied: number;
    replyRate: number;
  };
};

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  confirmed_email: string | null;
  inferred_email: string | null;
  company: string | null;
  company_name: string | null;
  status: string | null;
  created_at: string | null;
};

type DiscoveryBadge = "verified" | "most_probable";

type DiscoveryResult = {
  email: string;
  confidence: number;
  badge: DiscoveryBadge;
  domain: string | null;
};

type EnrichApiResponse = {
  error?: string;
  success?: boolean;
  topResult?: {
    email?: string;
    confidence?: number;
    badge?: string;
  };
  enrichment?: {
    domain?: string;
  };
  emails?: Array<{
    email?: string;
    confidence?: number;
  }>;
  feature?: string;
  used?: number;
  limit?: number;
};

type DashboardStat = {
  label: string;
  value: string;
  change: number | null;
};

type PersonaStatusResponse = {
  persona?: Persona | null;
  profile_persona?: Persona | null;
};

type NextStep = {
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const EXTENSION_DISMISS_KEY = "ellyn_extension_install_banner_dismissed";
const ONBOARDING_DONE_KEY = "ellyn_onboarding_done";
const DISCOVERY_FORM_ID = "dashboard-email-discovery-form";

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (nested && typeof nested === "object") {
      return nested as T;
    }
  }

  return payload as T;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function toPercentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function statusBadgeClassName(status: string): string {
  if (status === "replied") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "contacted" || status === "sent") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "bounced" || status === "no_response") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusLabel(status: string): string {
  if (status === "contacted") return "Sent";
  if (status === "no_response") return "No Response";
  if (status === "discovered") return "Discovered";
  if (status === "sent") return "Sent";
  if (status === "bounced") return "Bounced";
  if (status === "replied") return "Replied";
  return "New";
}

function formatContactDate(value: string | null): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatChange(change: number | null): { text: string; className: string } {
  if (change === null) {
    return { text: "—", className: "text-slate-500" };
  }

  if (change === 0) {
    return { text: "0.0%", className: "text-slate-500" };
  }

  const sign = change > 0 ? "+" : "";
  const className = change > 0 ? "text-emerald-600" : "text-rose-600";

  return {
    text: `${sign}${change.toFixed(1)}%`,
    className,
  };
}

function buildNextSteps(persona: Persona): NextStep[] {
  if (persona === "smb_sales") {
    return [
      {
        title: "Import Your Lead List",
        description: "Bring existing prospects into ELLYN to start outbound campaigns faster.",
        cta: "Import Leads",
        href: "/dashboard/contacts",
        icon: Users,
      },
      {
        title: "Build Your First Sequence",
        description: "Create a multi-touch outbound flow with personalized follow-ups.",
        cta: "Create Sequence",
        href: "/dashboard/sequences/new",
        icon: GitBranch,
      },
      {
        title: "Set Up Email Templates",
        description: "Save reusable sales messaging for faster outreach and consistency.",
        cta: "Open Templates",
        href: "/dashboard/templates",
        icon: FileText,
      },
    ];
  }

  return [
    {
      title: "Install Chrome Extension",
      description: "Capture hiring managers and recruiters directly from LinkedIn profiles.",
      cta: "Install Extension",
      href: process.env.NEXT_PUBLIC_EXTENSION_URL ?? "https://chromewebstore.google.com",
      icon: Search,
    },
    {
      title: "Create Your First Sequence",
      description: "Set up a follow-up sequence for applications and networking messages.",
      cta: "Create Sequence",
      href: "/dashboard/sequences/new",
      icon: GitBranch,
    },
    {
      title: "Explore Templates",
      description: "Use proven outreach templates for referrals, intros, and follow-ups.",
      cta: "Browse Templates",
      href: "/dashboard/templates",
      icon: FileText,
    },
  ];
}

function StatCard({ stat }: { stat: DashboardStat }) {
  const change = formatChange(stat.change);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {stat.label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold text-[#2D2B55]">{stat.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-sm font-medium ${change.className}`}>{change.text}</p>
        <p className="mt-1 text-xs text-slate-500">vs previous 30 days</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { persona } = usePersona();
  const { planType, refresh: refreshSubscription, isLoading: subscriptionLoading } = useSubscription();
  const copy = getPersonaCopy(persona);

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [recentContacts, setRecentContacts] = useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [isFindingEmail, setIsFindingEmail] = useState(false);

  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isContactSaved, setIsContactSaved] = useState(false);

  const [quotaExceeded, setQuotaExceeded] = useState<{
    feature: string;
    used: number;
    limit: number;
  } | null>(null);

  const [showExtensionBanner, setShowExtensionBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [didShowUpgradeToast, setDidShowUpgradeToast] = useState(false);

  const extensionInstallUrl =
    process.env.NEXT_PUBLIC_EXTENSION_URL ?? "https://chromewebstore.google.com";

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch("/api/v1/analytics/user", { cache: "no-store" });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? "Failed to load dashboard stats");
      }

      const raw = (await response.json()) as unknown;
      const data = unwrapPayload<DashboardAnalytics>(raw);
      setAnalytics(data);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to load dashboard stats");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const response = await fetch("/api/v1/contacts?limit=10&sort=created_at:desc", {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error ?? "Failed to load recent contacts");
      }

      const raw = (await response.json()) as unknown;
      const data = unwrapPayload<{ contacts?: ContactRow[] }>(raw);
      setRecentContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to load recent contacts");
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchAnalytics(), fetchContacts()]);
  }, [fetchAnalytics, fetchContacts]);

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      void refreshSubscription();
    }
  }, [refreshSubscription, searchParams]);

  useEffect(() => {
    if (searchParams.get("upgraded") !== "true" || didShowUpgradeToast || subscriptionLoading) {
      return;
    }

    const planLabel = planType === "pro" ? "Pro" : planType === "starter" ? "Starter" : "Free";
    showToast.success(`Welcome to ${planLabel}! Your quota has been updated.`);
    setDidShowUpgradeToast(true);
  }, [didShowUpgradeToast, planType, searchParams, subscriptionLoading]);

  useEffect(() => {
    const dismissed = localStorage.getItem(EXTENSION_DISMISS_KEY) === "1";
    if (dismissed) {
      setShowExtensionBanner(false);
      return;
    }

    const extensionId = process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID;
    const runtime = (
      window as Window & {
        chrome?: {
          runtime?: {
            sendMessage?: (
              extensionId: string,
              message: unknown,
              callback?: (response: unknown) => void
            ) => void;
            lastError?: { message?: string };
          };
        };
      }
    ).chrome?.runtime;

    if (!extensionId || !runtime?.sendMessage) {
      setShowExtensionBanner(true);
      return;
    }

    let resolved = false;
    const timeoutId = window.setTimeout(() => {
      if (!resolved) {
        setShowExtensionBanner(true);
      }
    }, 1200);

    try {
      runtime.sendMessage(extensionId, { type: "ELLYN_PING" }, (response) => {
        resolved = true;
        window.clearTimeout(timeoutId);

        const hasRuntimeError = Boolean(runtime.lastError);
        setShowExtensionBanner(hasRuntimeError || !response);
      });
    } catch {
      window.clearTimeout(timeoutId);
      setShowExtensionBanner(true);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const evaluateOnboardingState = async () => {
      let localOnboardingDone = false;
      try {
        localOnboardingDone = localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
      } catch {
        localOnboardingDone = false;
      }

      let serverPersonaMissing = false;
      try {
        const response = await fetch("/api/v1/user/persona", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as PersonaStatusResponse;
          const persistedPersona = payload.profile_persona ?? payload.persona ?? null;
          serverPersonaMissing = persistedPersona === null;
        }
      } catch {
        serverPersonaMissing = false;
      }

      if (cancelled || (!serverPersonaMissing && localOnboardingDone)) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          setShowOnboarding(true);
        }
      }, 500);
    };

    void evaluateOnboardingState();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const handleFindEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !companyName.trim()) {
      showToast.error("First name, last name, and company are required");
      return;
    }

    setIsFindingEmail(true);
    setQuotaExceeded(null);
    setDiscoveryResult(null);
    setIsContactSaved(false);

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim(),
          role: role.trim() || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as EnrichApiResponse;

      if (response.status === 402) {
        setQuotaExceeded({
          feature: typeof data.feature === "string" ? data.feature : "email_generation",
          used: Number(data.used ?? 0),
          limit: Number(data.limit ?? 0),
        });
        return;
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.error ?? "Could not find an email for this contact");
      }

      const discoveredEmail = data.topResult?.email ?? data.emails?.[0]?.email;
      if (!discoveredEmail) {
        throw new Error("No email candidates returned");
      }

      setDiscoveryResult({
        email: discoveredEmail,
        confidence: Number(data.topResult?.confidence ?? data.emails?.[0]?.confidence ?? 0),
        badge: data.topResult?.badge === "verified" ? "verified" : "most_probable",
        domain: data.enrichment?.domain ?? null,
      });
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to discover email");
    } finally {
      setIsFindingEmail(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!discoveryResult) return;

    try {
      await navigator.clipboard.writeText(discoveryResult.email);
      showToast.success("Email copied to clipboard");
    } catch {
      showToast.error("Failed to copy email");
    }
  };

  const handleSaveContact = async () => {
    if (!discoveryResult) return;

    setIsSavingContact(true);
    try {
      const response = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: companyName.trim(),
          role: role.trim() || undefined,
          inferredEmail: discoveryResult.email,
          emailConfidence: discoveryResult.confidence,
          companyDomain: discoveryResult.domain ?? undefined,
          source: "manual",
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to save contact");
      }

      setIsContactSaved(true);
      showToast.success("Saved to contacts");
      await Promise.all([fetchContacts(), fetchAnalytics()]);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save contact");
    } finally {
      setIsSavingContact(false);
    }
  };

  const dismissExtensionBanner = () => {
    localStorage.setItem(EXTENSION_DISMISS_KEY, "1");
    setShowExtensionBanner(false);
  };

  const nextSteps = useMemo(() => buildNextSteps(persona), [persona]);

  const stats = useMemo<DashboardStat[]>(() => {
    if (!analytics) {
      return [
        { label: copy.statsContactsLabel, value: "0", change: null },
        { label: copy.statsEmailsLabel, value: "0", change: null },
        { label: copy.statsRepliesLabel, value: "0", change: null },
        { label: copy.statsReplyRateLabel, value: "0%", change: null },
      ];
    }

    const previous = analytics.previousPeriod;

    const repliesChange = previous ? toPercentChange(analytics.totalReplied, previous.replied) : null;

    const replyRateChange = previous
      ? toPercentChange(analytics.replyRate, previous.replyRate)
      : null;

    return [
      {
        label: copy.statsContactsLabel,
        value: formatNumber(analytics.totalContacts),
        change: previous && previous.contacts > 0 ? analytics.periodComparison.contacts : null,
      },
      {
        label: copy.statsEmailsLabel,
        value: formatNumber(analytics.totalSent),
        change: previous && previous.sent > 0 ? analytics.periodComparison.sent : null,
      },
      {
        label: copy.statsRepliesLabel,
        value: formatNumber(analytics.totalReplied),
        change: repliesChange,
      },
      {
        label: copy.statsReplyRateLabel,
        value: `${analytics.replyRate.toFixed(1)}%`,
        change: replyRateChange,
      },
    ];
  }, [analytics, copy]);

  return (
    <DashboardShell>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Dashboard"
          description={copy.dashboardSubtitle}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void Promise.all([fetchAnalytics(), fetchContacts()]);
              }}
            >
              Refresh Data
            </Button>
          }
        />

        {showExtensionBanner ? (
          <Card className="border-[#2D2B55]/15 bg-[#F4F2FF]">
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#2D2B55]">Chrome extension not detected</p>
                <p className="text-sm text-[#4D4A72]">
                  Install the ELLYN Chrome Extension to capture profile data directly from LinkedIn.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild>
                  <a href={extensionInstallUrl} target="_blank" rel="noreferrer">
                    Install Chrome Extension
                  </a>
                </Button>
                <Button type="button" variant="outline" onClick={dismissExtensionBanner}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {analyticsLoading
            ? [0, 1, 2, 3].map((index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Email Discovery</CardTitle>
              <CardDescription>Find verified emails and save them to your contacts list.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form id={DISCOVERY_FORM_ID} className="grid gap-4 md:grid-cols-2" onSubmit={handleFindEmail}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#2D2B55]" htmlFor="firstName">
                    First Name*
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#2D2B55]" htmlFor="lastName">
                    Last Name*
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#2D2B55]" htmlFor="companyName">
                    Company Name*
                  </label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Acme"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#2D2B55]" htmlFor="role">
                    Role (optional)
                  </label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Recruiting Manager"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={isFindingEmail}>
                    {isFindingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Find Email
                  </Button>
                </div>
              </form>

              {quotaExceeded ? (
                <UpgradePrompt
                  feature={quotaExceeded.feature}
                  used={quotaExceeded.used}
                  limit={quotaExceeded.limit}
                />
              ) : null}

              {discoveryResult ? (
                <Card className="border-slate-200 bg-slate-50">
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="break-all text-2xl font-semibold text-[#2D2B55]">{discoveryResult.email}</p>
                      <Badge
                        className={
                          discoveryResult.badge === "verified"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : "border-amber-200 bg-amber-100 text-amber-700"
                        }
                      >
                        {discoveryResult.badge === "verified" ? "Verified" : "Most Probable"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">Confidence: {discoveryResult.confidence.toFixed(1)}%</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" onClick={handleCopyEmail}>
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          void handleSaveContact();
                        }}
                        disabled={isSavingContact || isContactSaved}
                      >
                        {isSavingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                        {isContactSaved ? "Saved" : "Save to Contacts"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription>Go to your most-used workflow in one click.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" asChild className="w-full justify-start">
                <Link href="/dashboard/contacts">
                  <Users className="h-4 w-4" />
                  View Contacts
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full justify-start">
                <Link href="/dashboard/sequences/new">
                  <GitBranch className="h-4 w-4" />
                  Create Sequence
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full justify-start">
                <Link href="/dashboard/templates">
                  <FileText className="h-4 w-4" />
                  Browse Templates
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">Recent Contacts</CardTitle>
                <CardDescription>Last 10 contacts saved to your workspace.</CardDescription>
              </div>
              <Button variant="link" asChild className="text-[#2D2B55]">
                <Link href="/dashboard/contacts">View all contacts</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="h-10 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : recentContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                    <Target className="h-8 w-8 text-[#2D2B55]" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-[#2D2B55]">No contacts yet</p>
                  <p className="mt-1 text-sm text-slate-600">Find your first email above.</p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() => {
                      document.getElementById(DISCOVERY_FORM_ID)?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    Find your first email above
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentContacts.map((contact) => {
                      const name =
                        contact.full_name?.trim() ||
                        `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
                        "Unknown";
                      const email =
                        contact.confirmed_email || contact.inferred_email || contact.email || "-";
                      const company = contact.company || contact.company_name || "-";
                      const status = (contact.status ?? "new").toLowerCase();

                      return (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium text-[#2D2B55]">{name}</TableCell>
                          <TableCell>{email}</TableCell>
                          <TableCell>{company}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusBadgeClassName(
                                status
                              )}`}
                            >
                              {statusLabel(status)}
                            </span>
                          </TableCell>
                          <TableCell>{formatContactDate(contact.created_at)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="grid gap-4 md:grid-cols-3">
            {nextSteps.map((step) => {
              const Icon = step.icon;
              const isExternal = step.href.startsWith("http");

              return (
                <Card key={step.title}>
                  <CardHeader className="pb-3">
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#F3F1FF] text-[#2D2B55]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      {isExternal ? (
                        <a href={step.href} target="_blank" rel="noreferrer">
                          {step.cta}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link href={step.href}>
                          {step.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
      <PersonaOnboardingModal open={showOnboarding} onOpenChange={setShowOnboarding} />
    </DashboardShell>
  );
}
