"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  FilePenLine,
  MailOpen,
  MessageCircleReply,
  NotebookText,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import type { TrackerContact, TrackerTimelineEvent } from "@/lib/types/tracker";
import { getDisplayEmail, getDisplayName } from "@/lib/tracker-v2";

interface ContactDetailModalProps {
  open: boolean;
  contact: TrackerContact | null;
  onOpenChange: (open: boolean) => void;
  onSave: (contactId: string, updates: Partial<TrackerContact>) => Promise<void> | void;
}

interface DraftHistoryItem {
  id: string;
  subject: string;
  status: "draft" | "sent";
  updated_at: string;
}

interface DraftApiItem {
  id: string | number;
  subject?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function timelineIcon(eventType: TrackerTimelineEvent["type"]) {
  switch (eventType) {
    case "draft_created":
      return <FilePenLine className="h-4 w-4 text-slate-500" />;
    case "email_sent":
      return <Send className="h-4 w-4 text-[#FF7B7B]" />;
    case "replied":
      return <MessageCircleReply className="h-4 w-4 text-emerald-600" />;
    case "note_added":
      return <NotebookText className="h-4 w-4 text-amber-600" />;
    case "reminder_set":
      return <CalendarClock className="h-4 w-4 text-violet-600" />;
    case "status_changed":
    default:
      return <MailOpen className="h-4 w-4 text-sky-600" />;
  }
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

/**
 * Render the ContactDetailModal component.
 * @param {ContactDetailModalProps} props - Component props.
 * @returns {unknown} JSX output for ContactDetailModal.
 * @example
 * <ContactDetailModal />
 */
export function ContactDetailModal({ open, contact, onOpenChange, onSave }: ContactDetailModalProps) {
  const [notes, setNotes] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [draftHistory, setDraftHistory] = useState<DraftHistoryItem[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [draftHistoryError, setDraftHistoryError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(contact?.notes || "");
    setReminderDate(toDateInputValue(contact?.reminder_at));
  }, [contact]);

  useEffect(() => {
    if (!open || !contact?.id) {
      setDraftHistory([]);
      setDraftHistoryError(null);
      return;
    }
    const contactId = contact.id;

    const controller = new AbortController();

    async function loadDraftHistory() {
      try {
        setIsLoadingDrafts(true);
        setDraftHistoryError(null);

        const response = await fetch(`/api/v1/drafts?contactId=${encodeURIComponent(contactId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const drafts: DraftApiItem[] = Array.isArray(payload?.drafts) ? payload.drafts : [];
        setDraftHistory(
          drafts.map((draft) => ({
            id: String(draft.id),
            subject: String(draft.subject || "Untitled draft"),
            status: draft.status === "sent" ? "sent" : "draft",
            updated_at: String(draft.updated_at || draft.created_at || new Date().toISOString()),
          }))
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setDraftHistoryError("Unable to load draft history.");
      } finally {
        setIsLoadingDrafts(false);
      }
    }

    void loadDraftHistory();

    return () => controller.abort();
  }, [contact?.id, open]);

  const timeline = useMemo(() => {
    if (!contact?.timeline) return [];
    return [...contact.timeline].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  }, [contact?.timeline]);

  const handleSave = async () => {
    if (!contact) return;
    setIsSaving(true);
    try {
      await onSave(contact.id, {
        notes: notes.trim() || null,
        reminder_at: fromDateInputValue(reminderDate),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{contact ? getDisplayName(contact) : "Contact details"}</DialogTitle>
          <DialogDescription>
            Review notes, reminders, and timeline activity for this contact.
          </DialogDescription>
        </DialogHeader>

        {contact ? (
          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <section className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-medium text-slate-900">{contact.role || "-"}</p>
                <p className="text-sm text-slate-600">{contact.company || "-"}</p>
                <p className="mt-2 text-sm text-slate-700">{getDisplayEmail(contact) || "-"}</p>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Draft history</h3>
                  <Link
                    href={`/dashboard/sequences?contactId=${encodeURIComponent(contact.id)}`}
                    className="text-xs font-medium text-[#FF7B7B] hover:underline"
                  >
                    Open drafts
                  </Link>
                </div>
                {isLoadingDrafts ? (
                  <p className="text-xs text-slate-500">Loading drafts...</p>
                ) : draftHistoryError ? (
                  <p className="text-xs text-rose-600">{draftHistoryError}</p>
                ) : draftHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">No drafts yet for this contact.</p>
                ) : (
                  <ul className="space-y-2">
                    {draftHistory.slice(0, 5).map((draft) => (
                      <li key={draft.id} className="rounded-md border border-slate-200 px-3 py-2 text-xs">
                        <p className="truncate font-medium text-slate-800">{draft.subject}</p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-slate-500">
                          <span className="capitalize">{draft.status}</span>
                          <span>{new Date(draft.updated_at).toLocaleDateString()}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="detail-notes">Notes</Label>
                <Textarea
                  id="detail-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={6}
                  placeholder="Add context, follow-up points, and reminders..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="detail-reminder">Follow-up reminder</Label>
                <Input
                  id="detail-reminder"
                  type="date"
                  value={reminderDate}
                  onChange={(event) => setReminderDate(event.target.value)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Activity timeline</h3>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                {timeline.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity yet.</p>
                ) : (
                  timeline.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full border border-slate-200 p-1.5">
                        {timelineIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={isSaving || !contact}
            className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b]"
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

