"use client";

import Link from "next/link";
import { MouseEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { showToast } from "@/lib/toast";

type SequenceStatus = "draft" | "active" | "paused" | "archived";

type SequenceListItem = {
  id: string;
  name: string;
  description: string;
  status: SequenceStatus;
  step_count: number;
  enrollment_count: number;
  created_at: string | null;
};

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

function statusClassName(status: SequenceStatus): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "archived") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function statusLabel(status: SequenceStatus): string {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "archived") return "Archived";
  return "Draft";
}

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<SequenceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState<SequenceListItem | null>(null);

  const fetchSequences = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/sequences", { cache: "no-store" });
      const payload = await parseJson(response);

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to fetch sequences"));
      }

      const rows = (payload as { sequences?: unknown }).sequences;
      setSequences(Array.isArray(rows) ? (rows as SequenceListItem[]) : []);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to fetch sequences");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSequences();
  }, [fetchSequences]);

  const handleDelete = async () => {
    if (!sequenceToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/sequences/${sequenceToDelete.id}`, {
        method: "DELETE",
      });
      const payload = await parseJson(response);

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to delete sequence"));
      }

      setSequenceToDelete(null);
      setSequences((prev) => prev.filter((sequence) => sequence.id !== sequenceToDelete.id));
      showToast.success("Sequence deleted");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete sequence");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <PageHeader
        title="Sequences"
        actions={
          <Button asChild>
            <Link href="/dashboard/sequences/new">
              <Plus className="h-4 w-4" />
              New Sequence
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-[#E6E4F2] bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="rounded-xl bg-white p-4">
          <EmptyState
            icon={<Plus className="h-7 w-7" />}
            title="No sequences yet"
            description="No sequences yet. Create your first outreach sequence."
            action={{
              label: "New Sequence",
              onClick: () => {
                window.location.href = "/dashboard/sequences/new";
              },
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="border-[#E6E4F2] bg-white">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1 text-base text-[#2D2B55]">{sequence.name}</CardTitle>
                  <Badge className={statusClassName(sequence.status)}>{statusLabel(sequence.status)}</Badge>
                </div>
                <CardDescription className="line-clamp-2 text-sm text-slate-600">
                  {sequence.description?.trim() || "No description"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm text-slate-700">
                  <p className="font-medium">{sequence.step_count} steps</p>
                  <p>{sequence.enrollment_count} enrolled contacts</p>
                  <p className="text-xs text-slate-500">Created {formatDate(sequence.created_at)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/sequences/${sequence.id}`}>Edit</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setSequenceToDelete(sequence)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(sequenceToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSequenceToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The sequence and all related enrollments will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
