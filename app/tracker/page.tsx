"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { PersonaProvider, usePersona } from "@/context/PersonaContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import { showToast } from "@/lib/toast";

type TrackerStatus = "saved" | "applied" | "interviewing" | "offered" | "rejected";

type TrackerApplication = {
  id: string;
  user_id: string;
  company_name: string;
  role: string;
  status: TrackerStatus;
  applied_date: string | null;
  notes: string | null;
  job_url: string | null;
  created_at: string;
};

type FormState = {
  company_name: string;
  role: string;
  status: TrackerStatus;
  applied_date: string;
  notes: string;
  job_url: string;
};

const STATUS_COLUMNS: Array<{ key: TrackerStatus; label: string }> = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offered", label: "Offered" },
  { key: "rejected", label: "Rejected" },
];

const EMPTY_FORM: FormState = {
  company_name: "",
  role: "",
  status: "saved",
  applied_date: "",
  notes: "",
  job_url: "",
};

function toFormState(application?: TrackerApplication | null): FormState {
  if (!application) return EMPTY_FORM;
  return {
    company_name: application.company_name,
    role: application.role,
    status: application.status,
    applied_date: application.applied_date ?? "",
    notes: application.notes ?? "",
    job_url: application.job_url ?? "",
  };
}

function TrackerPageContent() {
  const router = useRouter();
  const { persona, isLoading: personaLoading } = usePersona();

  const [applications, setApplications] = useState<TrackerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<TrackerApplication | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<TrackerApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns = useMemo(() => {
    const grouped: Record<TrackerStatus, TrackerApplication[]> = {
      saved: [],
      applied: [],
      interviewing: [],
      offered: [],
      rejected: [],
    };

    for (const application of applications) {
      grouped[application.status].push(application);
    }

    return grouped;
  }, [applications]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const response = await supabaseAuthedFetch("/api/v1/tracker");
      const payload = (await response.json().catch(() => ({}))) as {
        applications?: TrackerApplication[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load applications");
      }

      setApplications(payload.applications ?? []);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (personaLoading) return;

    if (persona === "smb_sales") {
      router.replace("/dashboard");
      return;
    }

    void loadApplications();
  }, [persona, personaLoading, router]);

  const openCreateModal = () => {
    setEditingApplication(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (application: TrackerApplication) => {
    setEditingApplication(application);
    setForm(toFormState(application));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingApplication(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.company_name.trim() || !form.role.trim()) {
      showToast.error("Company name and role are required");
      return;
    }

    setIsSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      role: form.role.trim(),
      status: form.status,
      applied_date: form.applied_date || null,
      notes: form.notes.trim() || null,
      job_url: form.job_url.trim() || null,
    };

    try {
      const response = await supabaseAuthedFetch(
        editingApplication ? `/api/v1/tracker/${editingApplication.id}` : "/api/v1/tracker",
        {
          method: editingApplication ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        application?: TrackerApplication;
        error?: string;
      };

      if (!response.ok || !body.application) {
        throw new Error(body.error ?? "Failed to save application");
      }

      if (editingApplication) {
        setApplications((prev) =>
          prev.map((item) => (item.id === editingApplication.id ? body.application! : item))
        );
        showToast.success("Application updated");
      } else {
        setApplications((prev) => [body.application!, ...prev]);
        showToast.success("Application added");
      }

      closeModal();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save application");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveStatus = async (application: TrackerApplication, status: TrackerStatus) => {
    if (application.status === status) return;

    const previousStatus = application.status;
    setMovingId(application.id);
    setApplications((prev) =>
      prev.map((item) => (item.id === application.id ? { ...item, status } : item))
    );

    try {
      const response = await supabaseAuthedFetch(`/api/v1/tracker/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to move application");
      }
    } catch (error) {
      setApplications((prev) =>
        prev.map((item) =>
          item.id === application.id ? { ...item, status: previousStatus } : item
        )
      );
      showToast.error(error instanceof Error ? error.message : "Failed to move application");
    } finally {
      setMovingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const response = await supabaseAuthedFetch(`/api/v1/tracker/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to delete application");
      }

      setApplications((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast.success("Application deleted");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete application");
    } finally {
      setIsDeleting(false);
    }
  };

  if (personaLoading || (persona !== "job_seeker" && !isLoading)) {
    return (
      <DashboardShell withChrome>
        <div className="p-6">
          <div className="flex items-center gap-2 text-sm text-[#5E5B86]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tracker...
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell withChrome>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Application Tracker"
          description="Track your job applications from saved to final outcome."
          actions={
            <Button type="button" onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Add Application
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#E6E4F2] bg-white p-4 text-sm text-[#5E5B86]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading applications...
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {STATUS_COLUMNS.map((column) => {
              const columnItems = columns[column.key];

              return (
                <div key={column.key} className="w-[280px] flex-shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="font-semibold text-[#2D2B55]">{column.label}</h2>
                    <span className="rounded-full bg-[#EDEBFA] px-2 py-0.5 text-xs font-medium text-[#2D2B55]">
                      {columnItems.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {columnItems.map((application) => (
                      <Card
                        key={application.id}
                        className="cursor-pointer border-[#E6E4F2] hover:border-[#D8D3F5]"
                        onClick={() => openEditModal(application)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-[#2D2B55]">{application.company_name}</CardTitle>
                          <p className="text-sm text-[#5E5B86]">{application.role}</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-xs text-[#5E5B86]">
                            Applied: {application.applied_date || "Not set"}
                          </p>
                          <p className="line-clamp-2 text-xs text-[#5E5B86]">
                            {application.notes || "No notes"}
                          </p>

                          <div
                            className="space-y-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Label className="text-xs">Move to</Label>
                            <Select
                              value={application.status}
                              onValueChange={(value) =>
                                void handleMoveStatus(application, value as TrackerStatus)
                              }
                              disabled={movingId === application.id}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_COLUMNS.map((option) => (
                                  <SelectItem key={option.key} value={option.key}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div
                            className="flex justify-end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeleteTarget(application)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {columnItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#D8D6EA] bg-white p-4 text-center text-sm text-[#5E5B86]">
                        No applications
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingApplication ? "Edit Application" : "Add Application"}</DialogTitle>
            <DialogDescription>
              Track one job opportunity in your pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company_name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as TrackerStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="applied_date">Applied Date</Label>
              <Input
                id="applied_date"
                type="date"
                value={form.applied_date}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, applied_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_url">Job URL</Label>
              <Input
                id="job_url"
                type="url"
                value={form.job_url}
                onChange={(event) => setForm((prev) => ({ ...prev, job_url: event.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[110px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingApplication ? "Save Changes" : "Add Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this application from your tracker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

export default function TrackerPage() {
  return (
    <SubscriptionProvider>
      <PersonaProvider>
        <TrackerPageContent />
      </PersonaProvider>
    </SubscriptionProvider>
  );
}
