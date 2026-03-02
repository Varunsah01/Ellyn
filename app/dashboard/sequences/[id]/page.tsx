"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Loader2, Pencil, Play, PlusCircle, X } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { showToast } from "@/lib/toast";

type SequenceStatus = "draft" | "active" | "paused" | "archived";
type EnrollmentStatus = "active" | "paused" | "completed" | "bounced";

type SequenceRecord = {
  id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  created_at: string | null;
};

type SequenceStepRecord = {
  id: string;
  step_order: number | null;
  step_name: string | null;
  step_type: "email" | "wait" | "condition" | "task" | null;
  subject: string | null;
  body: string | null;
  delay_days: number | null;
};

type EnrollmentContactSnapshot = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type SequenceEnrollmentRecord = {
  id: string;
  contact_id: string;
  status: EnrollmentStatus | null;
  current_step_index: number | null;
  started_at: string | null;
  completed_at: string | null;
  contact?: EnrollmentContactSnapshot | null;
};

type SequenceStats = {
  active: number;
  completed: number;
  bounced: number;
};

type SequenceDetailResponse = {
  sequence: SequenceRecord;
  steps: SequenceStepRecord[];
  enrollments: SequenceEnrollmentRecord[];
  stats: SequenceStats;
};

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorValue = (payload as { error?: unknown }).error;
    if (typeof errorValue === "string" && errorValue.trim()) {
      return errorValue;
    }
  }
  return fallback;
}

function statusBadgeClass(status: SequenceStatus | EnrollmentStatus | null): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "completed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "bounced") return "border-red-200 bg-red-50 text-red-700";
  if (status === "archived") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function toLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .split("_")
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ""))
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nextSequenceStatus(status: SequenceStatus): SequenceStatus {
  if (status === "draft") return "active";
  if (status === "active") return "paused";
  if (status === "paused") return "active";
  return "draft";
}

function contactDisplayName(contact: EnrollmentContactSnapshot | null | undefined): string {
  if (!contact) return "Unknown Contact";
  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  return fullName || "Unknown Contact";
}

export default function SequenceDetailPage() {
  const params = useParams();
  const sequenceId = params.id as string;

  const [data, setData] = useState<SequenceDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "contacts">("overview");
  const [statusFilter, setStatusFilter] = useState<"all" | EnrollmentStatus>("all");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/sequences/${sequenceId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as SequenceDetailResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to load sequence"));
      }

      setData(payload);
      setNameDraft(payload.sequence.name);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to load sequence");
    } finally {
      setIsLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedSteps = useMemo(() => {
    if (!data) return [];
    return [...data.steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [data]);

  const filteredEnrollments = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.enrollments;
    return data.enrollments.filter((enrollment) => enrollment.status === statusFilter);
  }, [data, statusFilter]);

  const handleUpdateSequence = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!data) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(body, "Failed to update sequence"));
      }

      showToast.success(successMessage);
      await refresh();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update sequence");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateEnrollmentStatus = async (enrollmentId: string, status: "active" | "paused") => {
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to update enrollment"));
      }

      showToast.success(status === "paused" ? "Enrollment paused" : "Enrollment resumed");
      await refresh();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update enrollment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!window.confirm("Remove this contact from the sequence?")) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to remove enrollment"));
      }

      showToast.success("Contact removed");
      await refresh();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to remove enrollment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      showToast.error("Name cannot be empty");
      return;
    }

    await handleUpdateSequence({ name: trimmed }, "Sequence name updated");
    setIsEditingName(false);
  };

  if (isLoading) {
    return (
      <DashboardShell className="px-4 py-6 md:px-8">
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#E6E4F2] bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return (
      <DashboardShell className="px-4 py-6 md:px-8">
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">Sequence not found.</CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const enrolledCount = data.enrollments.length;

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <div className="space-y-6">
        <PageHeader
          title="Sequence Detail"
          description="Review sequence performance and manage enrolled contacts."
          actions={
            <Button asChild>
              <Link href={`/dashboard/sequences/${sequenceId}/enroll`}>
                <PlusCircle className="h-4 w-4" />
                Enroll Contacts
              </Link>
            </Button>
          }
        />

        <Card className="border-[#E6E4F2] bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="h-9" />
                    <Button type="button" size="sm" onClick={() => void handleSaveName()} disabled={isUpdating}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setIsEditingName(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-[#2D2B55]">{data.sequence.name}</h1>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingName(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <p className="text-sm text-slate-600">{data.sequence.description?.trim() || "No description"}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={statusBadgeClass(data.sequence.status)}>{toLabel(data.sequence.status)}</Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void handleUpdateSequence(
                      { status: nextSequenceStatus(data.sequence.status) },
                      `Sequence set to ${toLabel(nextSequenceStatus(data.sequence.status))}`
                    )
                  }
                  disabled={isUpdating}
                >
                  <Play className="h-4 w-4" />
                  Toggle Status
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 border-b border-[#E6E4F2]">
          <Button
            type="button"
            variant={activeTab === "overview" ? "default" : "ghost"}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </Button>
          <Button
            type="button"
            variant={activeTab === "contacts" ? "default" : "ghost"}
            onClick={() => setActiveTab("contacts")}
          >
            Contacts
          </Button>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Enrolled</p>
                  <p className="text-2xl font-semibold text-[#2D2B55]">{enrolledCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Active</p>
                  <p className="text-2xl font-semibold text-[#2D2B55]">{data.stats.active}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Completed</p>
                  <p className="text-2xl font-semibold text-[#2D2B55]">{data.stats.completed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">Bounced</p>
                  <p className="text-2xl font-semibold text-[#2D2B55]">{data.stats.bounced}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Step Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedSteps.length === 0 ? (
                  <p className="text-sm text-slate-600">No steps configured.</p>
                ) : (
                  sortedSteps.map((step, index) => (
                    <div key={step.id} className="rounded-md border border-[#E6E4F2] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#2D2B55]">
                          Step {index + 1}: {step.step_name || toLabel(step.step_type)}
                        </p>
                        <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                          {toLabel(step.step_type)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Delay: {Math.max(0, Number(step.delay_days ?? 0))} day(s)
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "contacts" && (
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Enrolled Contacts</CardTitle>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as "all" | EnrollmentStatus)}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredEnrollments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#D9D6EE] bg-[#FAFAFA] p-8 text-center">
                  <p className="text-sm font-medium text-[#2D2B55]">No enrollments yet</p>
                  <p className="mt-1 text-xs text-slate-600">Enroll contacts to start this sequence.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E6E4F2] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-3">Name</th>
                        <th className="px-2 py-3">Email</th>
                        <th className="px-2 py-3">Current Step</th>
                        <th className="px-2 py-3">Status</th>
                        <th className="px-2 py-3">Enrolled At</th>
                        <th className="px-2 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EEF8]">
                      {filteredEnrollments.map((enrollment) => {
                        const stepIndex = Math.max(0, Number(enrollment.current_step_index ?? 0));
                        const currentStep = sortedSteps[stepIndex];

                        return (
                          <tr key={enrollment.id}>
                            <td className="px-2 py-3 font-medium text-[#2D2B55]">
                              {contactDisplayName(enrollment.contact)}
                            </td>
                            <td className="px-2 py-3 text-slate-700">
                              {enrollment.contact?.email || "-"}
                            </td>
                            <td className="px-2 py-3 text-slate-700">
                              {currentStep?.step_name || (currentStep?.step_type ? toLabel(currentStep.step_type) : "-")}
                            </td>
                            <td className="px-2 py-3">
                              <Badge className={statusBadgeClass(enrollment.status)}>{toLabel(enrollment.status)}</Badge>
                            </td>
                            <td className="px-2 py-3 text-slate-700">{formatDate(enrollment.started_at)}</td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-2">
                                {enrollment.status === "paused" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isUpdating}
                                    onClick={() => void handleUpdateEnrollmentStatus(enrollment.id, "active")}
                                  >
                                    Resume
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isUpdating}
                                    onClick={() => void handleUpdateEnrollmentStatus(enrollment.id, "paused")}
                                  >
                                    Pause
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={isUpdating}
                                  onClick={() => void handleRemoveEnrollment(enrollment.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
