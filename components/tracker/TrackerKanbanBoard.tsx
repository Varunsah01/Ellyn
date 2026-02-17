"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BellRing, CalendarClock, Circle, Loader2 } from "lucide-react";
import type { TrackerContact } from "@/lib/types/tracker";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  EditContactButton,
  FollowUpButton,
  MoreActionsButton,
} from "@/components/tracker/ActionButtons";
import {
  EditContactModal,
  type EditableTrackerContact,
  type EditContactPayload,
} from "@/components/tracker/EditContactModal";
import { ConfirmDeleteModal } from "@/components/tracker/ConfirmDeleteModal";
import { AddNoteModal } from "@/components/tracker/AddNoteModal";
import { StatusPipeline, type PipelineStage } from "@/components/tracker/StatusPipeline";
import {
  TRACKER_STATUS_COLORS,
  TRACKER_STATUS_LABEL_BY_CONTACT_STATUS,
  getBoardLaneFromContact,
  getDisplayEmail,
  getDisplayName,
  isNeedsFollowUp,
  type TrackerBoardLane,
} from "@/lib/tracker-v2";

interface TrackerKanbanBoardProps {
  contacts: TrackerContact[];
  selectedContactIds: string[];
  onToggleSelectContact: (contactId: string) => void;
  onUpdateContact: (contactId: string, updates: Partial<TrackerContact>) => Promise<void> | void;
  onDeleteContact: (contactId: string) => Promise<void> | void;
  onOpenContactDetail: (contact: TrackerContact) => void;
  focusedContactId?: string | null;
  condensed?: boolean;
}

interface LaneMeta {
  lane: TrackerBoardLane;
  label: string;
  helperText: string;
  status: TrackerContact["status"];
}

const LANE_META: LaneMeta[] = [
  {
    lane: "drafted",
    label: "Drafted",
    helperText: "Fresh leads waiting for first outreach.",
    status: "new",
  },
  {
    lane: "sent",
    label: "Sent",
    helperText: "Initial outreach sent. Watch for opens.",
    status: "contacted",
  },
  {
    lane: "replied",
    label: "Replied",
    helperText: "Warm conversations to prioritize now.",
    status: "replied",
  },
  {
    lane: "no_response",
    label: "No Response",
    helperText: "Nudge or archive after follow-up.",
    status: "no_response",
  },
];

const CONTACT_STATUS_BY_STAGE: Record<PipelineStage, TrackerContact["status"]> = {
  draft: "new",
  sent: "contacted",
  opened: "no_response",
  replied: "replied",
};

function normalizeOutreachStage(rawStatus: string | null | undefined): PipelineStage | null {
  if (!rawStatus) return null;

  switch (rawStatus.toLowerCase()) {
    case "draft":
    case "drafted":
      return "draft";
    case "sent":
      return "sent";
    case "opened":
      return "opened";
    case "replied":
      return "replied";
    default:
      return null;
  }
}

function deriveStageFromContact(contact: TrackerContact): PipelineStage {
  const outreachStage = normalizeOutreachStage(contact.outreach_status);
  if (outreachStage) return outreachStage;

  switch (contact.status) {
    case "contacted":
      return "sent";
    case "no_response":
      return "opened";
    case "replied":
      return "replied";
    default:
      return "draft";
  }
}

function normalizeLinkedInUrl(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function useVirtualWindow(itemCount: number, itemHeight: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(420);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      setContainerHeight(container.clientHeight || 420);
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [itemCount]);

  const overscan = 4;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.max(8, Math.ceil(containerHeight / itemHeight) + overscan * 2);
  const endIndex = Math.min(itemCount, startIndex + visibleCount);

  return {
    containerRef,
    startIndex,
    endIndex,
    paddingTop: startIndex * itemHeight,
    paddingBottom: Math.max(0, (itemCount - endIndex) * itemHeight),
    onScroll: (event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    },
  };
}

interface KanbanCardProps {
  contact: TrackerContact;
  selected: boolean;
  focused: boolean;
  condensed: boolean;
  onToggleSelectContact: (contactId: string) => void;
  onOpenContactDetail: (contact: TrackerContact) => void;
  onFollowUp: (contact: TrackerContact) => void;
  onEdit: (contact: TrackerContact) => void;
  onViewLinkedIn: (contact: TrackerContact) => void;
  onMarkReplied: (contact: TrackerContact) => void;
  onMarkNotInterested: (contact: TrackerContact) => void;
  onAddNote: (contact: TrackerContact) => void;
  onDelete: (contact: TrackerContact) => void;
  onStatusChange: (contact: TrackerContact, nextStatus: PipelineStage) => Promise<void> | void;
}

function KanbanCard({
  contact,
  selected,
  focused,
  condensed,
  onToggleSelectContact,
  onOpenContactDetail,
  onFollowUp,
  onEdit,
  onViewLinkedIn,
  onMarkReplied,
  onMarkNotInterested,
  onAddNote,
  onDelete,
  onStatusChange,
}: KanbanCardProps) {
  const name = getDisplayName(contact);
  const email = getDisplayEmail(contact) || "No email";
  const statusColor = TRACKER_STATUS_COLORS[contact.status];
  const currentStage = deriveStageFromContact(contact);
  const needsFollowUp = isNeedsFollowUp(contact);
  const company = (contact.company || "Unknown").trim() || "Unknown";

  return (
    <article
      className={`group rounded-xl border bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
        focused ? "ring-2 ring-[#FF7B7B]/40" : "border-slate-200"
      }`}
      aria-label={`${name} at ${company}`}
      tabIndex={0}
      onClick={() => onOpenContactDetail(contact)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpenContactDetail(contact);
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelectContact(contact.id);
            }}
            className="shrink-0"
            aria-label={`Select ${name}`}
          >
            <Checkbox checked={selected} />
          </button>

          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: statusColor.dot }}
            aria-hidden
          >
            {company.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{company}</p>
          </div>
        </div>

        <div
          className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreActionsButton
            onViewLinkedIn={() => onViewLinkedIn(contact)}
            onMarkReplied={() => onMarkReplied(contact)}
            onMarkNotInterested={() => onMarkNotInterested(contact)}
            onAddNote={() => onAddNote(contact)}
            onDelete={() => onDelete(contact)}
          />
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Circle className="h-2.5 w-2.5 fill-current" style={{ color: statusColor.dot }} />
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor.badge} ${statusColor.badgeText}`}
        >
          {TRACKER_STATUS_LABEL_BY_CONTACT_STATUS[contact.status]}
        </span>
        {needsFollowUp ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            <CalendarClock className="h-3 w-3" />
            Overdue
          </span>
        ) : null}
        {contact.reminder_at ? <BellRing className="h-3.5 w-3.5 text-amber-500" /> : null}
      </div>

      {!condensed ? (
        <div className="space-y-2">
          <p className="truncate text-xs text-slate-600 dark:text-slate-300">{contact.role || "No role"}</p>
          <p className="truncate text-xs font-mono text-slate-500 dark:text-slate-400">{email}</p>
          <div onClick={(event) => event.stopPropagation()}>
            <StatusPipeline
              currentStatus={currentStage}
              contactId={contact.id}
              compact
              onStatusChange={(nextStatus) => onStatusChange(contact, nextStatus)}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <FollowUpButton onFollowUp={() => onFollowUp(contact)} />
        <EditContactButton onEdit={() => onEdit(contact)} />
      </div>
    </article>
  );
}

interface LaneColumnProps {
  lane: LaneMeta;
  contacts: TrackerContact[];
  totalContacts: number;
  condensed: boolean;
  selectedSet: Set<string>;
  focusedContactId: string | null;
  onToggleSelectContact: (contactId: string) => void;
  onOpenContactDetail: (contact: TrackerContact) => void;
  onFollowUp: (contact: TrackerContact) => void;
  onEdit: (contact: TrackerContact) => void;
  onViewLinkedIn: (contact: TrackerContact) => void;
  onMarkReplied: (contact: TrackerContact) => void;
  onMarkNotInterested: (contact: TrackerContact) => void;
  onAddNote: (contact: TrackerContact) => void;
  onDelete: (contact: TrackerContact) => void;
  onStatusChange: (contact: TrackerContact, nextStatus: PipelineStage) => Promise<void> | void;
}

function LaneColumn({
  lane,
  contacts,
  totalContacts,
  condensed,
  selectedSet,
  focusedContactId,
  onToggleSelectContact,
  onOpenContactDetail,
  onFollowUp,
  onEdit,
  onViewLinkedIn,
  onMarkReplied,
  onMarkNotInterested,
  onAddNote,
  onDelete,
  onStatusChange,
}: LaneColumnProps) {
  const tone = TRACKER_STATUS_COLORS[lane.status];
  const itemHeight = condensed ? 140 : 220;
  const { containerRef, startIndex, endIndex, paddingTop, paddingBottom, onScroll } = useVirtualWindow(
    contacts.length,
    itemHeight
  );
  const visibleContacts = contacts.slice(startIndex, endIndex);
  const laneProgress = totalContacts > 0 ? Math.round((contacts.length / totalContacts) * 100) : 0;

  return (
    <section
      className={`flex min-h-[480px] flex-col rounded-xl border border-slate-200 ${tone.softColumn} ${tone.softColumnDark} dark:border-slate-800`}
      aria-label={`${lane.label} column`}
    >
      <header className="space-y-2 border-b border-slate-200/70 p-3 dark:border-slate-800/70">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lane.label}</h2>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            {contacts.length}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{lane.helperText}</p>
        <div className="h-1.5 rounded-full bg-white/70 dark:bg-slate-900/60">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${Math.max(6, laneProgress)}%`, backgroundColor: tone.dot }}
          />
        </div>
      </header>

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {contacts.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300/80 bg-white/60 px-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No contacts in this stage yet.
          </div>
        ) : (
          <div
            className="space-y-2"
            style={{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }}
          >
            {visibleContacts.map((contact) => (
              <KanbanCard
                key={contact.id}
                contact={contact}
                selected={selectedSet.has(contact.id)}
                focused={focusedContactId === contact.id}
                condensed={condensed}
                onToggleSelectContact={onToggleSelectContact}
                onOpenContactDetail={onOpenContactDetail}
                onFollowUp={onFollowUp}
                onEdit={onEdit}
                onViewLinkedIn={onViewLinkedIn}
                onMarkReplied={onMarkReplied}
                onMarkNotInterested={onMarkNotInterested}
                onAddNote={onAddNote}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Render the TrackerKanbanBoard component.
 * @param {TrackerKanbanBoardProps} props - Component props.
 * @returns {unknown} JSX output for TrackerKanbanBoard.
 * @example
 * <TrackerKanbanBoard />
 */
export function TrackerKanbanBoard({
  contacts,
  selectedContactIds,
  onToggleSelectContact,
  onUpdateContact,
  onDeleteContact,
  onOpenContactDetail,
  focusedContactId = null,
  condensed = false,
}: TrackerKanbanBoardProps) {
  const [editingContact, setEditingContact] = useState<EditableTrackerContact | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<TrackerContact | null>(null);
  const [contactForNote, setContactForNote] = useState<TrackerContact | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [isFollowUpOpening, setIsFollowUpOpening] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedContactIds), [selectedContactIds]);

  const contactsByLane = useMemo(() => {
    const grouped: Record<TrackerBoardLane, TrackerContact[]> = {
      drafted: [],
      sent: [],
      replied: [],
      no_response: [],
    };

    for (const contact of contacts) {
      grouped[getBoardLaneFromContact(contact)].push(contact);
    }

    return grouped;
  }, [contacts]);

  const updateContact = async (
    contactId: string,
    updates: Partial<TrackerContact>,
    successMessage?: string
  ) => {
    await onUpdateContact(contactId, updates);

    if (successMessage) {
      toast.success(successMessage);
    }

    if (updates.status === "replied") {
      toast.success("Reply milestone reached. Keep momentum.");
    }
  };

  const generateDraftTemplate = (contact: TrackerContact) => {
    const firstName = (getDisplayName(contact).split(" ")[0] || "there").trim();
    const company = contact.company || "your team";

    return `Hi ${firstName},

I hope you are doing well. I wanted to quickly follow up regarding opportunities at ${company}.

If you are open to it, I would appreciate a short conversation.

Best,
Varun`;
  };

  const handleFollowUp = (contact: TrackerContact) => {
    const email = getDisplayEmail(contact);
    if (!email) {
      toast.error("No email available for this contact.");
      return;
    }

    setIsFollowUpOpening(contact.id);
    const subject = encodeURIComponent(`Follow-up regarding ${contact.company || "opportunity"}`);
    const body = encodeURIComponent(generateDraftTemplate(contact));
    const recipient = encodeURIComponent(email);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${recipient}&su=${subject}&body=${body}`;
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${recipient}&subject=${subject}&body=${body}`;

    const preferredClient =
      typeof window !== "undefined" ? window.localStorage.getItem("ellyn:preferred-mail-client") : null;
    const composeUrl = preferredClient === "outlook" ? outlookUrl : gmailUrl;

    window.open(composeUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setIsFollowUpOpening(null), 300);
  };

  const handleSaveEdit = async (payload: EditContactPayload) => {
    if (!editingContact) return;

    setIsSavingEdit(true);
    try {
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      await updateContact(
        editingContact.id,
        {
          first_name: payload.firstName,
          last_name: payload.lastName,
          full_name: fullName,
          role: payload.role,
          company: payload.company,
          confirmed_email: payload.confirmedEmail,
          linkedin_url: payload.linkedinUrl,
          notes: payload.notes,
        },
        "Contact updated."
      );
      setEditingContact(null);
    } catch {
      toast.error("Unable to update contact.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleMarkAsReplied = async (contact: TrackerContact) => {
    try {
      await updateContact(contact.id, { status: "replied", outreach_status: "replied" }, "Marked as replied.");
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const handleMarkAsNotInterested = async (contact: TrackerContact) => {
    const currentNotes = (contact.notes || "").trim();
    const marker = `Marked as not interested on ${new Date().toLocaleDateString()}.`;
    const nextNotes = currentNotes ? `${currentNotes}\n${marker}` : marker;
    const currentTags = Array.isArray(contact.tags) ? contact.tags : [];
    const nextTags = currentTags.includes("not_interested") ? currentTags : [...currentTags, "not_interested"];

    try {
      await updateContact(
        contact.id,
        {
          status: "no_response",
          outreach_status: "opened",
          notes: nextNotes,
          tags: nextTags,
        },
        "Marked as not interested."
      );
    } catch {
      toast.error("Failed to update contact.");
    }
  };

  const handleOpenLinkedIn = (contact: TrackerContact) => {
    const linkedinUrl = normalizeLinkedInUrl(contact.linkedin_url);
    if (!linkedinUrl) {
      toast.error("LinkedIn URL not available.");
      return;
    }

    window.open(linkedinUrl, "_blank", "noopener,noreferrer");
  };

  const handleSaveNote = async (note: string) => {
    if (!contactForNote) return;

    setIsSavingNote(true);
    try {
      await updateContact(contactForNote.id, { notes: note.trim() || null }, "Note saved.");
      setContactForNote(null);
    } catch {
      toast.error("Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!contactPendingDelete) return;

    setIsDeletingContact(true);
    try {
      await onDeleteContact(contactPendingDelete.id);
      toast.success("Contact deleted.");
      setContactPendingDelete(null);
    } catch {
      toast.error("Unable to delete contact.");
    } finally {
      setIsDeletingContact(false);
    }
  };

  const handlePipelineStatusChange = async (contact: TrackerContact, nextStatus: PipelineStage) => {
    await updateContact(contact.id, {
      status: CONTACT_STATUS_BY_STAGE[nextStatus],
      outreach_status: nextStatus,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <>
      <section className="space-y-3">
        {isFollowUpOpening ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Opening follow-up draft...
          </div>
        ) : null}

        <div className="grid min-h-[calc(100vh-21rem)] gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {LANE_META.map((lane) => (
            <LaneColumn
              key={lane.lane}
              lane={lane}
              contacts={contactsByLane[lane.lane]}
              totalContacts={contacts.length}
              condensed={condensed}
              selectedSet={selectedSet}
              focusedContactId={focusedContactId}
              onToggleSelectContact={onToggleSelectContact}
              onOpenContactDetail={onOpenContactDetail}
              onFollowUp={handleFollowUp}
              onEdit={(contact) => setEditingContact(contact)}
              onViewLinkedIn={handleOpenLinkedIn}
              onMarkReplied={(contact) => {
                void handleMarkAsReplied(contact);
              }}
              onMarkNotInterested={(contact) => {
                void handleMarkAsNotInterested(contact);
              }}
              onAddNote={(contact) => setContactForNote(contact)}
              onDelete={(contact) => setContactPendingDelete(contact)}
              onStatusChange={(contact, nextStatus) => {
                void handlePipelineStatusChange(contact, nextStatus);
              }}
            />
          ))}
        </div>
      </section>

      <EditContactModal
        open={Boolean(editingContact)}
        contact={editingContact}
        isSaving={isSavingEdit}
        onOpenChange={(open) => {
          if (!open) {
            setEditingContact(null);
          }
        }}
        onSave={handleSaveEdit}
      />

      <AddNoteModal
        open={Boolean(contactForNote)}
        contactName={contactForNote ? getDisplayName(contactForNote) : "this contact"}
        initialNote={contactForNote?.notes || ""}
        isSaving={isSavingNote}
        onCancel={() => setContactForNote(null)}
        onSave={handleSaveNote}
      />

      <ConfirmDeleteModal
        open={Boolean(contactPendingDelete)}
        contactName={contactPendingDelete ? getDisplayName(contactPendingDelete) : "this contact"}
        isDeleting={isDeletingContact}
        onCancel={() => setContactPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
