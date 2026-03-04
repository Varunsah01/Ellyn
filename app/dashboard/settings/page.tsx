"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { EmailIntegrationCard } from "@/components/settings/EmailIntegrationCard";
import { AdminAccessLink } from "@/components/settings/AdminAccessLink";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Progress } from "@/components/ui/Progress";
import { useSubscription } from "@/context/SubscriptionContext";
import { useEmailIntegrations } from "@/hooks/useEmailIntegrations";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";

type SettingsTab = "account" | "billing";

type ProfilePayload = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type InvoiceRow = {
  id: string;
  date: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  download_url: string | null;
};

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null || !Number.isFinite(amount)) return "-";
  const normalized = Number.isInteger(amount) ? amount / 100 : amount;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
  }).format(normalized);
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "U";

  const token = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return token || "U";
}

function clampPercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const ratio = (used / limit) * 100;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, ratio));
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [hasLoadedInvoices, setHasLoadedInvoices] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { gmail, outlook, disconnectGmail, disconnectOutlook, refetch } =
    useEmailIntegrations();

  const {
    planType,
    subscriptionStatus,
    emailLookupsUsed,
    emailLookupsLimit,
    aiDraftUsed,
    aiDraftLimit,
    resetDate,
  } = useSubscription();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "billing") {
      setActiveTab("billing");
      return;
    }
    if (tab === "account") {
      setActiveTab("account");
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setIsLoadingProfile(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          throw new Error(error?.message || "Unable to load user");
        }

        const metadata =
          user.user_metadata && typeof user.user_metadata === "object"
            ? (user.user_metadata as Record<string, unknown>)
            : {};

        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("full_name, email, avatar_url")
          .eq("id", user.id)
          .maybeSingle<ProfilePayload>();

        if (cancelled) return;

        const resolvedEmail =
          (profileData?.email && profileData.email.trim()) || user.email || "";
        const resolvedName =
          (profileData?.full_name && profileData.full_name.trim()) ||
          (typeof metadata.full_name === "string" ? metadata.full_name : "");
        const resolvedAvatar =
          (profileData?.avatar_url && profileData.avatar_url.trim()) ||
          (typeof metadata.avatar_url === "string" ? metadata.avatar_url : "");

        setEmail(resolvedEmail);
        setFullName(resolvedName);
        setAvatarUrl(resolvedAvatar);
      } catch (error) {
        showToast.error(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // OAuth callback toasts + URL cleanup — run once on mount
  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    const outlookParam = searchParams.get("outlook");

    if (gmailParam === "success") {
      showToast.success("Gmail connected successfully");
      void refetch();
    } else if (gmailParam === "error") {
      showToast.error("Failed to connect Gmail. Please try again.");
    }

    if (outlookParam === "success") {
      showToast.success("Outlook connected successfully");
      void refetch();
    } else if (outlookParam === "error") {
      showToast.error("Failed to connect Outlook. Please try again.");
    }

    if (gmailParam || outlookParam) {
      router.replace("/dashboard/settings?tab=account");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== "billing" || hasLoadedInvoices) {
      return;
    }

    let cancelled = false;

    const loadInvoices = async () => {
      setIsLoadingInvoices(true);

      try {
        const response = await fetch("/api/v1/subscription/invoices", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          invoices?: InvoiceRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(parseError(payload, "Failed to load invoices"));
        }

        if (!cancelled) {
          setInvoices(Array.isArray(payload.invoices) ? payload.invoices : []);
          setHasLoadedInvoices(true);
        }
      } catch (error) {
        if (!cancelled) {
          showToast.error(error instanceof Error ? error.message : "Failed to load invoices");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInvoices(false);
        }
      }
    };

    void loadInvoices();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasLoadedInvoices]);

  const usage = useMemo(
    () => ({
      emailPercent: clampPercent(emailLookupsUsed, emailLookupsLimit),
      aiPercent: clampPercent(aiDraftUsed, aiDraftLimit),
    }),
    [aiDraftLimit, aiDraftUsed, emailLookupsLimit, emailLookupsUsed]
  );

  const isPaidPlan = planType === "starter" || planType === "pro";
  const canCancel = isPaidPlan && subscriptionStatus === "active";

  const handleSaveProfile = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      showToast.error("Full name is required");
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: trimmed }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        profile?: { full_name?: string | null };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to save profile"));
      }

      setFullName(payload.profile?.full_name?.trim() || trimmed);
      showToast.success("Profile updated");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showToast.error("Current password is required");
      return;
    }

    if (newPassword.length < 8) {
      showToast.error("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to update password"));
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast.success("Password updated");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };


  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Settings"
          description="Manage your account, integrations, and billing usage."
        />

        <div className="flex items-center gap-2 border-b border-[#E6E4F2] pb-3">
          <Button
            type="button"
            variant={activeTab === "account" ? "default" : "ghost"}
            onClick={() => setActiveTab("account")}
          >
            Account
          </Button>
          <Button
            type="button"
            variant={activeTab === "billing" ? "default" : "ghost"}
            onClick={() => setActiveTab("billing")}
          >
            Billing & Plan
          </Button>
        </div>

        {activeTab === "account" && (
          <div className="space-y-4">
            <Card className="border-[#E6E4F2] bg-white">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your display name.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingProfile ? (
                  <div className="flex min-h-[120px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14 border border-[#E6E4F2]">
                        <AvatarImage src={avatarUrl || undefined} alt={fullName || email} />
                        <AvatarFallback>{initials(fullName, email)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-[#2D2B55]">{fullName || "Your Profile"}</p>
                        <p className="text-xs text-slate-600">{email || "No email"}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full-name">Full Name</Label>
                        <Input
                          id="full-name"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={email} readOnly disabled />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="button" onClick={() => void handleSaveProfile()} disabled={isSavingProfile}>
                        {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#E6E4F2] bg-white">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Use a password with at least 8 characters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleChangePassword()}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[#2D2B55]">Email Integrations</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Connect an email account to send outreach directly from Ellyn.
                </p>
              </div>
              <div className="space-y-2">
                <EmailIntegrationCard
                  provider="gmail"
                  status={gmail}
                  onConnect={() => { window.location.href = '/api/v1/auth/gmail' }}
                  onDisconnect={disconnectGmail}
                />
                <EmailIntegrationCard
                  provider="outlook"
                  status={outlook}
                  onConnect={() => { window.location.href = '/api/v1/auth/outlook' }}
                  onDisconnect={disconnectOutlook}
                />
              </div>
            </div>

            <AdminAccessLink />
          </div>
        )}

        {activeTab === "billing" && (
          <div className="space-y-4">
            <Card className="border-[#E6E4F2] bg-white">
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-[#2D2B55]">
                    {planType.charAt(0).toUpperCase() + planType.slice(1)}
                  </p>
                  <Badge variant="outline">{subscriptionStatus || "active"}</Badge>
                </div>
                {subscriptionStatus === "active" && resetDate ? (
                  <p className="text-sm text-slate-600">Renewal date: {formatDate(resetDate)}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-[#E6E4F2] bg-white">
              <CardHeader>
                <CardTitle>Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#2D2B55]">
                    Email Lookups: {emailLookupsUsed} / {emailLookupsLimit} used this month
                  </p>
                  <Progress value={usage.emailPercent} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#2D2B55]">
                    AI Drafts: {aiDraftUsed} / {aiDraftLimit} used this month
                  </p>
                  <Progress value={usage.aiPercent} />
                </div>

                <p className="text-xs text-slate-600">Resets on {formatDate(resetDate)}</p>
              </CardContent>
            </Card>

            {planType === "free" && (
              <Card className="border-[#FF6B6B] bg-[#FFF5F5]">
                <CardContent className="flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-[#2D2B55]">Upgrade to Starter or Pro</p>
                    <p className="text-sm text-slate-700">
                      Upgrade to Starter or Pro for more lookups and AI features.
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/upgrade">Upgrade Plan</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-[#E6E4F2] bg-white">
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingInvoices ? (
                  <div className="flex min-h-[120px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
                  </div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-slate-600">No invoices yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#E6E4F2] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-3">Date</th>
                          <th className="px-2 py-3">Amount</th>
                          <th className="px-2 py-3">Status</th>
                          <th className="px-2 py-3">Download</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EEF8]">
                        {invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="px-2 py-3">{formatDate(invoice.date)}</td>
                            <td className="px-2 py-3">{formatCurrency(invoice.amount, invoice.currency)}</td>
                            <td className="px-2 py-3">{invoice.status || "-"}</td>
                            <td className="px-2 py-3">
                              {invoice.download_url ? (
                                <Link
                                  href={invoice.download_url}
                                  className="text-blue-600 underline"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </Link>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {canCancel && (
              <Card className="border-[#E6E4F2] bg-white">
                <CardHeader>
                  <CardTitle>Cancel Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(true)}>
                    Cancel Subscription
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Please contact support to cancel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
