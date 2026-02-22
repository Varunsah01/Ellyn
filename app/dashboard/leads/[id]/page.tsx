"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Building2,
  Mail,
  Calendar,
  Trash2,
  CheckCircle2,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import type { Lead, EmailResult } from "@/lib/supabase";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Lead["status"]; label: string }[] = [
  { value: "discovered", label: "Discovered" },
  { value: "sent", label: "Sent" },
  { value: "bounced", label: "Bounced" },
  { value: "replied", label: "Replied" },
];

const STATUS_COLORS: Record<Lead["status"], string> = {
  discovered: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  bounced: "bg-red-500/10 text-red-600 border-red-500/20",
  replied: "bg-green-500/10 text-green-600 border-green-500/20",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function LeadDetailSkeleton() {
  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Leads", href: "/dashboard/leads" },
        { label: "Loading..." },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    </DashboardShell>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const className =
    confidence >= 80
      ? "bg-green-500/10 text-green-700 border-green-500/20"
      : confidence >= 60
      ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
      : "bg-gray-500/10 text-gray-600 border-gray-500/20";

  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-xs", className)}>
      {confidence}%
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const id = params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectingEmail, setSelectingEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await supabaseAuthedFetch(`/api/v1/leads/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { success: boolean; lead: Lead };
        if (!data.success) throw new Error("Failed to load lead");
        setLead(data.lead);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lead");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  // ─── Escape key — go back ──────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // ─── PATCH helper ──────────────────────────────────────────────────────

  const patch = useCallback(
    async (fields: Record<string, unknown>) => {
      const res = await supabaseAuthedFetch(`/api/v1/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { lead: Lead };
      return data.lead;
    },
    [id]
  );

  // ─── Optimistic status change ──────────────────────────────────────────

  const handleStatusChange = async (status: Lead["status"]) => {
    if (!lead) return;
    const oldStatus = lead.status;
    const label =
      STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

    // Optimistic update
    setLead((prev) => (prev ? { ...prev, status } : prev));

    try {
      await patch({ status });
      showToast.success(`Status updated to ${label}`);
    } catch (err) {
      // Revert on failure
      setLead((prev) => (prev ? { ...prev, status: oldStatus } : prev));
      showToast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    }
  };

  // ─── Copy email to clipboard ───────────────────────────────────────────

  const handleCopyEmail = () => {
    if (!lead?.selected_email) return;
    void navigator.clipboard.writeText(lead.selected_email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Select email ──────────────────────────────────────────────────────

  const handleSelectEmail = async (email: string) => {
    if (!lead || email === lead.selected_email) return;
    setSelectingEmail(email);
    try {
      const updated = await patch({ selectedEmail: email });
      setLead(updated);
      showToast.success("Selected email updated");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to select email"
      );
    } finally {
      setSelectingEmail(null);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await supabaseAuthedFetch(`/api/v1/leads/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete lead");
      showToast.success("Lead deleted");
      router.push("/dashboard/leads");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) return <LeadDetailSkeleton />;

  if (error || !lead) {
    return (
      <DashboardShell
        breadcrumbs={[{ label: "Leads", href: "/dashboard/leads" }]}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-muted-foreground">
            {error ?? "Lead not found"}
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/leads">Back to Leads</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === lead.status)?.label ?? lead.status;

  const sortedEmails = [...lead.discovered_emails].sort(
    (a, b) => b.confidence - a.confidence
  );

  const addedDate = new Date(lead.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const showUpdated =
    Math.abs(
      new Date(lead.updated_at).getTime() - new Date(lead.created_at).getTime()
    ) > 60_000;

  const updatedDate = showUpdated
    ? new Date(lead.updated_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Leads", href: "/dashboard/leads" },
        { label: lead.person_name },
      ]}
    >
      <div className="space-y-6">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">
              {lead.person_name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">
              {lead.company_name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {lead.selected_email && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.open(
                    `mailto:${lead.selected_email}?subject=Hi ${encodeURIComponent(lead.person_name)}`
                  )
                }
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Send Email
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete Lead
            </Button>
          </div>
        </div>

        {/* ── Status row ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Status
          </span>
          <Select
            value={lead.status}
            onValueChange={(v) => void handleStatusChange(v as Lead["status"])}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant="outline"
            className={cn("text-xs font-medium", STATUS_COLORS[lead.status])}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* ── Main grid ────────────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Person Name */}
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Person
                  </span>
                  <span className="block text-sm">{lead.person_name}</span>
                </div>
              </div>

              {/* Company */}
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Company
                  </span>
                  <span className="block text-sm">{lead.company_name}</span>
                </div>
              </div>

              {/* Selected Email + copy button */}
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Selected Email
                  </span>
                  {lead.selected_email ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`mailto:${lead.selected_email}`}
                        className="font-mono text-xs text-primary hover:underline truncate"
                      >
                        {lead.selected_email}
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy email address"
                      >
                        {copied ? (
                          <CheckCheck className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="block text-xs text-muted-foreground">
                      No email selected
                    </span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Added
                  </span>
                  <span className="block text-sm">{addedDate}</span>
                  {updatedDate && (
                    <span className="block text-xs text-muted-foreground">
                      Updated {updatedDate}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: All Discovered Emails */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                All Discovered Emails
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No emails discovered yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sortedEmails.map((result: EmailResult) => {
                    const isSelected = result.email === lead.selected_email;
                    const isSelecting = selectingEmail === result.email;

                    return (
                      <li
                        key={result.email}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                          isSelected
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-border"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-mono truncate">{result.email}</p>
                          <p className="text-muted-foreground">{result.pattern}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <ConfidenceBadge confidence={result.confidence} />

                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              disabled={selectingEmail !== null}
                              onClick={() => void handleSelectEmail(result.email)}
                            >
                              {isSelecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Select"
                              )}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{lead.person_name}</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Lead"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
