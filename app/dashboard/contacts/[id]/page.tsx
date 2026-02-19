"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Edit2,
  Save,
  X,
  Trash2,
  Globe,
  Mail,
  Building2,
  Briefcase,
  Tag,
  CheckCircle2,
  Loader2,
  Zap,
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
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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
import { Label } from "@/components/ui/Label";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiContact {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  company: string | null;
  role: string | null;
  inferred_email: string | null;
  confirmed_email: string | null;
  email_confidence: number | null;
  linkedin_url: string | null;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  status: "new" | "contacted" | "replied" | "no_response";
  created_at: string;
  updated_at: string;
}

interface EditForm {
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  inferredEmail: string;
  confirmedEmail: string;
  linkedinUrl: string;
  tags: string; // comma-separated
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "no_response", label: "No Response" },
] as const;

const STATUS_COLORS: Record<ApiContact["status"], string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  replied: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  no_response: "bg-red-500/10 text-red-600 border-red-500/20",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function contactToForm(c: ApiContact): EditForm {
  return {
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    company: c.company ?? "",
    role: c.role ?? "",
    inferredEmail: c.inferred_email ?? "",
    confirmedEmail: c.confirmed_email ?? "",
    linkedinUrl: c.linkedin_url ?? "",
    tags: (c.tags ?? []).join(", "),
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Contacts", href: "/dashboard/contacts" },
        { label: "Loading..." },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
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

// ─── Field row ───────────────────────────────────────────────────────────────

function Field({
  label,
  icon,
  editMode,
  editValue,
  onEditChange,
  placeholder,
  display,
  inputType = "text",
}: {
  label: string;
  icon: React.ReactNode;
  editMode: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  placeholder: string;
  display: string | null | undefined;
  inputType?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0 space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {editMode ? (
          <Input
            type={inputType}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder={placeholder}
            className="h-7 text-xs"
          />
        ) : (
          <span className="block text-sm">{display ?? "—"}</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const id = params.id;

  const [contact, setContact] = useState<ApiContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sequences, setSequences] = useState<Array<{ id: string; name: string }>>([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState("");
  const [enrollStartDate, setEnrollStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isEnrolling, setIsEnrolling] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await supabaseAuthedFetch(`/api/v1/contacts/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { success: boolean; contact: ApiContact };
        if (!data.success) throw new Error("Failed to load contact");
        setContact(data.contact);
        setNotes(data.contact.notes ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contact");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  // ─── PATCH helper ────────────────────────────────────────────────────────

  const patch = useCallback(
    async (fields: Record<string, unknown>) => {
      const res = await supabaseAuthedFetch(`/api/v1/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { contact: ApiContact };
      return data.contact;
    },
    [id]
  );

  // ─── Edit ─────────────────────────────────────────────────────────────────

  const startEdit = () => {
    if (!contact) return;
    setEditForm(contactToForm(contact));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setIsSaving(true);
    try {
      const updated = await patch({
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        company: editForm.company || undefined,
        role: editForm.role || undefined,
        inferredEmail: editForm.inferredEmail || undefined,
        confirmedEmail: editForm.confirmedEmail || undefined,
        linkedinUrl: editForm.linkedinUrl || undefined,
        tags: editForm.tags
          ? editForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      });
      setContact(updated);
      setEditMode(false);
      setEditForm(null);
      showToast.success("Contact updated");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Status ───────────────────────────────────────────────────────────────

  const handleStatusChange = async (status: ApiContact["status"]) => {
    if (!contact) return;
    try {
      const updated = await patch({ status });
      setContact(updated);
      showToast.success("Status updated");
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    }
  };

  // ─── Notes auto-save on blur ──────────────────────────────────────────────

  const handleNotesBlur = () => {
    if (!contact || notes === (contact.notes ?? "")) return;
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(() => {
      setNotesSaving(true);
      patch({ notes })
        .then((updated) => {
          setContact(updated);
        })
        .catch(() => {
          showToast.error("Failed to save notes");
        })
        .finally(() => {
          setNotesSaving(false);
        });
    }, 400);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await supabaseAuthedFetch(`/api/v1/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
      showToast.success("Contact deleted");
      router.push("/dashboard/contacts");
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ─── Enroll in sequence ───────────────────────────────────────────────────

  const openEnrollDialog = async () => {
    setEnrollOpen(true);
    if (sequences.length > 0) return;
    setSequencesLoading(true);
    try {
      const res = await supabaseAuthedFetch("/api/v1/sequences");
      if (!res.ok) throw new Error("Failed to load sequences");
      const data = (await res.json()) as { sequences: Array<{ id: string; name: string }> };
      const list = data.sequences ?? [];
      setSequences(list);
      if (list[0]) setSelectedSeqId(list[0].id);
    } catch {
      showToast.error("Failed to load sequences");
    } finally {
      setSequencesLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSeqId || !contact) return;
    setIsEnrolling(true);
    try {
      const res = await supabaseAuthedFetch(`/api/v1/sequences/${selectedSeqId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [id], startDate: enrollStartDate }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to enroll");
      }

      const seqName =
        sequences.find((s) => s.id === selectedSeqId)?.name ?? "sequence";
      const contactName =
        contact.full_name ||
        [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
        "Unknown";

      // Log activity (fire-and-forget)
      void supabaseAuthedFetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contacts_enrolled",
          description: `${contactName} enrolled in ${seqName}`,
          contactId: id,
          metadata: {
            contactName,
            sequenceName: seqName,
            company: contact.company,
          },
        }),
      }).catch((err) => console.error("[activity]", err));

      // Update contact status to "contacted"
      const updated = await patch({ status: "contacted" });
      setContact(updated);

      setEnrollOpen(false);
      showToast.success(`Enrolled in ${seqName}`);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setIsEnrolling(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <DetailSkeleton />;

  if (error || !contact) {
    return (
      <DashboardShell
        breadcrumbs={[{ label: "Contacts", href: "/dashboard/contacts" }]}
      >
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-muted-foreground">
            {error ?? "Contact not found"}
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/contacts">Back to Contacts</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const fullName =
    contact.full_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unknown";

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === contact.status)?.label ??
    contact.status;

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Contacts", href: "/dashboard/contacts" },
        { label: fullName },
      ]}
    >
      <div className="space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary select-none">
              {getInitials(fullName)}
            </div>
            <div className="min-w-0">
              {editMode && editForm ? (
                <div className="flex gap-2">
                  <Input
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                    placeholder="First name"
                    className="h-8 w-28 text-sm"
                  />
                  <Input
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lastName: e.target.value })
                    }
                    placeholder="Last name"
                    className="h-8 w-28 text-sm"
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-semibold leading-tight">
                  {fullName}
                </h1>
              )}
              <p className="mt-0.5 text-sm text-muted-foreground truncate">
                {[contact.role, contact.company].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {editMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void saveEdit()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button size="sm" onClick={() => void openEnrollDialog()}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Enroll in Sequence
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* ── Status row ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Status
          </span>
          <Select
            value={contact.status}
            onValueChange={(v) =>
              void handleStatusChange(v as ApiContact["status"])
            }
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
            className={cn(
              "text-xs font-medium",
              STATUS_COLORS[contact.status]
            )}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Field
                label="Company"
                icon={<Building2 className="h-3.5 w-3.5" />}
                editMode={editMode}
                editValue={editForm?.company ?? ""}
                onEditChange={(v) =>
                  editForm && setEditForm({ ...editForm, company: v })
                }
                placeholder="Company name"
                display={contact.company}
              />
              <Field
                label="Role"
                icon={<Briefcase className="h-3.5 w-3.5" />}
                editMode={editMode}
                editValue={editForm?.role ?? ""}
                onEditChange={(v) =>
                  editForm && setEditForm({ ...editForm, role: v })
                }
                placeholder="Role / Title"
                display={contact.role}
              />

              {/* Inferred email + confidence */}
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Inferred Email
                  </span>
                  {editMode && editForm ? (
                    <Input
                      type="email"
                      value={editForm.inferredEmail}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          inferredEmail: e.target.value,
                        })
                      }
                      placeholder="email@example.com"
                      className="h-7 text-xs"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">
                        {contact.inferred_email ?? "—"}
                      </span>
                      {contact.email_confidence != null && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-xs"
                        >
                          {contact.email_confidence}% confidence
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmed email */}
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Confirmed Email
                  </span>
                  {editMode && editForm ? (
                    <Input
                      type="email"
                      value={editForm.confirmedEmail}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          confirmedEmail: e.target.value,
                        })
                      }
                      placeholder="confirmed@example.com"
                      className="h-7 text-xs"
                    />
                  ) : (
                    <span className="font-mono text-xs">
                      {contact.confirmed_email ?? "—"}
                    </span>
                  )}
                </div>
              </div>

              {/* LinkedIn */}
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    LinkedIn
                  </span>
                  {editMode && editForm ? (
                    <Input
                      value={editForm.linkedinUrl}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          linkedinUrl: e.target.value,
                        })
                      }
                      placeholder="https://linkedin.com/in/..."
                      className="h-7 text-xs"
                    />
                  ) : contact.linkedin_url ? (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {contact.linkedin_url}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tags
                  </span>
                  {editMode && editForm ? (
                    <Input
                      value={editForm.tags}
                      onChange={(e) =>
                        setEditForm({ ...editForm, tags: e.target.value })
                      }
                      placeholder="tag1, tag2, tag3"
                      className="h-7 text-xs"
                    />
                  ) : (contact.tags ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="px-1.5 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right column: Notes + Meta */}
          <div className="flex flex-col gap-6">
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Notes</CardTitle>
                  {notesSaving && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Add notes about this contact…"
                  className="min-h-[160px] resize-y text-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Auto-saves on blur
                </p>
              </CardContent>
            </Card>

            {/* Meta card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium capitalize">
                    {contact.source ?? "Manual"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(contact.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="font-medium">
                    {new Date(contact.updated_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Enroll in Sequence dialog ───────────────────────────────────────── */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(open) => {
          setEnrollOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll in Sequence</DialogTitle>
          </DialogHeader>

          {sequencesLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading sequences…
            </div>
          ) : sequences.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground text-center">
              No sequences found. Create one first.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select a sequence</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sequences.map((seq) => (
                    <button
                      key={seq.id}
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition",
                        selectedSeqId === seq.id
                          ? "border-primary bg-primary/5 font-medium"
                          : "hover:border-muted-foreground/40"
                      )}
                      onClick={() => setSelectedSeqId(seq.id)}
                    >
                      {seq.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enroll-start-date">Start date</Label>
                <Input
                  id="enroll-start-date"
                  type="date"
                  value={enrollStartDate}
                  onChange={(e) => setEnrollStartDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnrollOpen(false)}
              disabled={isEnrolling}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleEnroll()}
              disabled={isEnrolling || !selectedSeqId || sequences.length === 0}
            >
              {isEnrolling ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Enrolling…
                </>
              ) : (
                "Enroll"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{fullName}</strong>? This
            action cannot be undone.
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
                "Delete Contact"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
