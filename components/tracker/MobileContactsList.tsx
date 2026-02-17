"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BellRing, Pencil, RefreshCw } from "lucide-react";
import type { TrackerContact } from "@/lib/types/tracker";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  EditContactModal,
  type EditableTrackerContact,
  type EditContactPayload,
} from "@/components/tracker/EditContactModal";
import { AddNoteModal } from "@/components/tracker/AddNoteModal";
import { ConfirmDeleteModal } from "@/components/tracker/ConfirmDeleteModal";
import { StatusPipeline, type PipelineStage } from "@/components/tracker/StatusPipeline";
import { MoreActionsButton } from "@/components/tracker/ActionButtons";
import { getDisplayName } from "@/lib/tracker-v2";

interface MobileContactsListProps {
  contacts: TrackerContact[];
  onRefresh: () => Promise<void> | void;
  onUpdateContact: (contactId: string, updates: Partial<TrackerContact>) => Promise<void> | void;
  onDeleteContact: (contactId: string) => Promise<void> | void;
  selectedContactIds: string[];
  onToggleSelectContact: (contactId: string) => void;
  onSelectNone: () => void;
  onOpenContactDetail: (contact: TrackerContact) => void;
  focusedContactId?: string | null;
}

interface MobileContactCardProps {
  contact: TrackerContact;
  selected: boolean;
  focused: boolean;
  onToggleSelect: (contactId: string) => void;
  onFollowUp: (contact: TrackerContact) => void;
  onEdit: (contact: TrackerContact) => void;
  onViewLinkedIn: (contact: TrackerContact) => void;
  onMarkReplied: (contact: TrackerContact) => void;
  onMarkNotInterested: (contact: TrackerContact) => void;
  onAddNote: (contact: TrackerContact) => void;
  onDelete: (contact: TrackerContact) => void;
  onStatusChange: (contact: TrackerContact, nextStatus: PipelineStage) => Promise<void> | void;
  onOpenDetail: (contact: TrackerContact) => void;
}

function getDisplayEmail(contact: TrackerContact): string {
  return contact.confirmed_email || contact.inferred_email || "-";
}

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

function deriveStageFromContact(contact: TrackerContact): PipelineStage | null {
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
      return null;
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

const CONTACT_STATUS_BY_STAGE: Record<PipelineStage, TrackerContact["status"]> = {
  draft: "new",
  sent: "contacted",
  opened: "no_response",
  replied: "replied",
};

function hasReminder(contact: TrackerContact): boolean {
  if (!contact.reminder_at) return false;
  const date = new Date(contact.reminder_at);
  return !Number.isNaN(date.getTime());
}

function MobileContactCard({
  contact,
  selected,
  focused,
  onToggleSelect,
  onFollowUp,
  onEdit,
  onViewLinkedIn,
  onMarkReplied,
  onMarkNotInterested,
  onAddNote,
  onDelete,
  onStatusChange,
  onOpenDetail,
}: MobileContactCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [deleteRevealed, setDeleteRevealed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    didLongPressRef.current = false;
    clearLongPressTimer();

    longPressTimerRef.current = setTimeout(() => {
      onToggleSelect(contact.id);
      didLongPressRef.current = true;
    }, 500);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const currentX = event.touches[0]?.clientX;
    const startX = touchStartXRef.current;
    if (typeof currentX !== "number" || typeof startX !== "number") return;

    const deltaX = currentX - startX;

    if (Math.abs(deltaX) > 8) {
      clearLongPressTimer();
    }

    if (deltaX < 0) {
      setSwipeOffset(Math.max(deltaX, -88));
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    touchStartXRef.current = null;

    if (didLongPressRef.current) {
      setSwipeOffset(0);
      return;
    }

    if (swipeOffset <= -56) {
      setDeleteRevealed(true);
    } else {
      setDeleteRevealed(false);
    }
    setSwipeOffset(0);
  };

  const currentStage = (deriveStageFromContact(contact) || "draft") as PipelineStage;

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center">
        <Button
          type="button"
          variant="destructive"
          className="h-full w-full rounded-none"
          onClick={() => onDelete(contact)}
          aria-label={`Delete ${getDisplayName(contact)}`}
        >
          Delete
        </Button>
      </div>

      <div
        className={`rounded-lg bg-white p-4 shadow transition-transform duration-150 ease-out ${
          focused ? "ring-2 ring-[#FF7B7B]/30" : ""
        }`}
        style={{ transform: `translateX(${deleteRevealed ? -88 : swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (deleteRevealed) {
            setDeleteRevealed(false);
            return;
          }
          onOpenDetail(contact);
        }}
      >
        <div className={`mb-3 rounded-md border p-3 ${selected ? "border-[#FF7B7B] bg-[#fff5f5]" : "border-slate-200"}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(contact.id)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Select ${getDisplayName(contact)}`}
                />
                <h3 className="truncate text-base font-semibold text-slate-900">{getDisplayName(contact)}</h3>
                {hasReminder(contact) ? <BellRing className="h-3.5 w-3.5 text-amber-500" /> : null}
              </div>
              <p className="truncate text-sm text-slate-600">{contact.role || "-"}</p>
              <p className="truncate text-sm text-slate-500">{contact.company || "-"}</p>
            </div>

            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#9CA3AF] hover:text-[#FF7B7B]"
                onClick={() => onEdit(contact)}
                aria-label="Edit contact"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <MoreActionsButton
                onViewLinkedIn={() => onViewLinkedIn(contact)}
                onMarkReplied={() => onMarkReplied(contact)}
                onMarkNotInterested={() => onMarkNotInterested(contact)}
                onAddNote={() => onAddNote(contact)}
                onDelete={() => onDelete(contact)}
              />
            </div>
          </div>

          <p className="mb-3 text-sm text-slate-700">{getDisplayEmail(contact)}</p>

          <div className="mb-4" onClick={(event) => event.stopPropagation()}>
            <StatusPipeline
              currentStatus={currentStage}
              contactId={contact.id}
              compact
              onStatusChange={(nextStatus) => onStatusChange(contact, nextStatus)}
            />
          </div>

          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              onClick={() => onFollowUp(contact)}
              className="h-9 flex-1 bg-[#FF7B7B] text-white hover:bg-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40"
            >
              Follow up
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-20 border-slate-200 text-slate-700 hover:border-[#FF7B7B] hover:text-[#FF7B7B]"
              onClick={() => onEdit(contact)}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Render the MobileContactsList component.
 * @param {MobileContactsListProps} props - Component props.
 * @returns {unknown} JSX output for MobileContactsList.
 * @example
 * <MobileContactsList />
 */
export function MobileContactsList({
  contacts,
  onRefresh,
  onUpdateContact,
  onDeleteContact,
  selectedContactIds,
  onToggleSelectContact,
  onSelectNone,
  onOpenContactDetail,
  focusedContactId = null,
}: MobileContactsListProps) {
  const [editingContact, setEditingContact] = useState<EditableTrackerContact | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<TrackerContact | null>(null);
  const [contactForNote, setContactForNote] = useState<TrackerContact | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const pullStartYRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(20);
  }, [contacts.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + 20, contacts.length));
      },
      {
        rootMargin: "120px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [contacts.length]);

  const updateContact = async (
    contactId: string,
    updates: Partial<TrackerContact>,
    successMessage?: string
  ) => {
    await onUpdateContact(contactId, updates);

    if (successMessage) {
      toast.success(successMessage);
    }
  };

  const generateDraftTemplate = (contact: TrackerContact) => {
    const firstName = (getDisplayName(contact).split(" ")[0] || "there").trim();
    const company = contact.company || "your team";

    return `Hi ${firstName},

I hope you are doing well. I came across your profile at ${company} and wanted to follow up regarding potential opportunities.

If you are open to it, I would really value a quick chat about your experience and any advice you might have for someone exploring roles there.

Thanks for your time.

Best,
Varun`;
  };

  const handleFollowUp = (contact: TrackerContact) => {
    const email = getDisplayEmail(contact);
    if (email === "-") {
      toast.error("No email available for this contact.");
      return;
    }

    const subject = encodeURIComponent(`Referral Request - ${contact.company || "Opportunity"}`);
    const body = encodeURIComponent(generateDraftTemplate(contact));
    const recipient = encodeURIComponent(email);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${recipient}&su=${subject}&body=${body}`;
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${recipient}&subject=${subject}&body=${body}`;
    const preferredClient =
      typeof window !== "undefined" ? window.localStorage.getItem("ellyn:preferred-mail-client") : null;
    const composeUrl = preferredClient === "outlook" ? outlookUrl : gmailUrl;

    window.open(composeUrl, "_blank", "noopener,noreferrer");
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

  const handleOpenLinkedIn = (contact: TrackerContact) => {
    const linkedinUrl = normalizeLinkedInUrl(contact.linkedin_url);
    if (!linkedinUrl) {
      toast.error("LinkedIn URL not available.");
      return;
    }

    window.open(linkedinUrl, "_blank", "noopener,noreferrer");
  };

  const handleMarkAsReplied = async (contact: TrackerContact) => {
    try {
      await updateContact(
        contact.id,
        { status: "replied", outreach_status: "replied" },
        "Marked as replied."
      );
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const handleMarkAsNotInterested = async (contact: TrackerContact) => {
    const currentNotes = (contact.notes || "").trim();
    const marker = `Marked as not interested on ${new Date().toLocaleDateString()}.`;
    const nextNotes = currentNotes ? `${currentNotes}\n${marker}` : marker;
    const currentTags = Array.isArray(contact.tags) ? contact.tags : [];
    const nextTags = currentTags.includes("not_interested")
      ? currentTags
      : [...currentTags, "not_interested"];

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

  const handleSaveNote = async (note: string) => {
    if (!contactForNote) return;

    setIsSavingNote(true);
    try {
      await updateContact(
        contactForNote.id,
        {
          notes: note.trim() || null,
        },
        "Note saved."
      );
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
      if (selectedContactIds.includes(contactPendingDelete.id)) {
        onToggleSelectContact(contactPendingDelete.id);
      }
    } catch {
      toast.error("Unable to delete contact.");
    } finally {
      setIsDeletingContact(false);
    }
  };

  const handleListTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0) return;
    pullStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleListTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (typeof pullStartYRef.current !== "number") return;
    if (window.scrollY > 0) return;

    const currentY = event.touches[0]?.clientY;
    if (typeof currentY !== "number") return;

    const deltaY = currentY - pullStartYRef.current;
    if (deltaY <= 0) {
      setPullDistance(0);
      setPullReady(false);
      return;
    }

    const distance = Math.min(96, deltaY * 0.55);
    setPullDistance(distance);
    setPullReady(distance >= 64);
  };

  const handleListTouchEnd = async () => {
    pullStartYRef.current = null;

    if (!pullReady || isPullRefreshing) {
      setPullDistance(0);
      setPullReady(false);
      return;
    }

    setIsPullRefreshing(true);
    try {
      await onRefresh();
      toast.success("Contacts refreshed.");
    } catch {
      toast.error("Unable to refresh contacts.");
    } finally {
      setIsPullRefreshing(false);
      setPullDistance(0);
      setPullReady(false);
    }
  };

  const handlePipelineStatusChange = async (contact: TrackerContact, nextStatus: PipelineStage) => {
    await updateContact(contact.id, {
      status: CONTACT_STATUS_BY_STAGE[nextStatus],
      outreach_status: nextStatus,
      updated_at: new Date().toISOString(),
    });
  };

  const visibleContacts = contacts.slice(0, visibleCount);

  return (
    <>
      <div
        className="space-y-3"
        onTouchStart={handleListTouchStart}
        onTouchMove={handleListTouchMove}
        onTouchEnd={() => {
          void handleListTouchEnd();
        }}
      >
        <div
          className={`mx-auto flex w-fit items-center gap-2 text-xs text-slate-500 transition-all ${
            pullDistance > 0 || isPullRefreshing ? "opacity-100" : "h-0 opacity-0"
          }`}
          style={{ transform: `translateY(${pullDistance}px)` }}
          aria-live="polite"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPullRefreshing ? "animate-spin" : ""}`} />
          <span>
            {isPullRefreshing
              ? "Refreshing contacts..."
              : pullReady
                ? "Release to refresh"
                : "Pull to refresh"}
          </span>
        </div>

        {selectedContactIds.length > 0 ? (
          <div className="rounded-lg border border-[#FF7B7B]/30 bg-[#fff5f5] px-3 py-2 text-xs text-slate-700">
            {selectedContactIds.length} selected
            <button
              type="button"
              className="ml-2 font-medium text-[#FF7B7B] hover:underline"
              onClick={onSelectNone}
            >
              Clear
            </button>
          </div>
        ) : null}

        {visibleContacts.map((contact) => (
          <MobileContactCard
            key={contact.id}
            contact={contact}
            selected={selectedContactIds.includes(contact.id)}
            focused={focusedContactId === contact.id}
            onToggleSelect={onToggleSelectContact}
            onFollowUp={handleFollowUp}
            onEdit={(value) => setEditingContact(value)}
            onViewLinkedIn={handleOpenLinkedIn}
            onMarkReplied={(value) => {
              void handleMarkAsReplied(value);
            }}
            onMarkNotInterested={(value) => {
              void handleMarkAsNotInterested(value);
            }}
            onAddNote={(value) => setContactForNote(value)}
            onDelete={(value) => setContactPendingDelete(value)}
            onStatusChange={(contactItem, nextStatus) => {
              void handlePipelineStatusChange(contactItem, nextStatus);
            }}
            onOpenDetail={onOpenContactDetail}
          />
        ))}

        {visibleCount < contacts.length ? (
          <div ref={loadMoreRef} className="py-2 text-center text-xs text-slate-500">
            Loading more contacts...
          </div>
        ) : null}
      </div>

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
