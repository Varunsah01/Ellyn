"use client";

import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BellRing } from "lucide-react";
import type { TrackerContact } from "@/lib/types/tracker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EditContactButton,
  FollowUpButton,
  MoreActionsButton,
} from "@/components/tracker/ActionButtons";
import { StatusPipeline, type PipelineStage } from "@/components/tracker/StatusPipeline";
import {
  EditContactModal,
  type EditableTrackerContact,
  type EditContactPayload,
} from "@/components/tracker/EditContactModal";
import { ConfirmDeleteModal } from "@/components/tracker/ConfirmDeleteModal";
import { AddNoteModal } from "@/components/tracker/AddNoteModal";
import { getDisplayName, groupContactsByCompany } from "@/lib/tracker-v2";

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

interface ContactsTableProps {
  contacts: TrackerContact[];
  onUpdateContact: (contactId: string, updates: Partial<TrackerContact>) => Promise<void> | void;
  onDeleteContact: (contactId: string) => Promise<void> | void;
  selectedContactIds: string[];
  onToggleSelectContact: (contactId: string) => void;
  onSelectAllVisible: () => void;
  onSelectNone: () => void;
  onOpenContactDetail: (contact: TrackerContact) => void;
  focusedContactId?: string | null;
  groupByCompany?: boolean;
  compact?: boolean;
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

export function ContactsTable({
  contacts,
  onUpdateContact,
  onDeleteContact,
  selectedContactIds,
  onToggleSelectContact,
  onSelectAllVisible,
  onSelectNone,
  onOpenContactDetail,
  focusedContactId = null,
  groupByCompany = false,
  compact = false,
}: ContactsTableProps) {
  const [editingContact, setEditingContact] = useState<EditableTrackerContact | null>(null);
  const [contactPendingDelete, setContactPendingDelete] = useState<TrackerContact | null>(null);
  const [contactForNote, setContactForNote] = useState<TrackerContact | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedContactIds), [selectedContactIds]);
  const allVisibleSelected = contacts.length > 0 && contacts.every((contact) => selectedSet.has(contact.id));

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

  const deleteContact = async (contactId: string) => {
    await onDeleteContact(contactId);
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
      await deleteContact(contactPendingDelete.id);
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

  const groups = groupByCompany
    ? groupContactsByCompany(contacts)
    : [{ company: "", items: contacts }];

  const tableColSpan = compact ? 9 : 10;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "3%" }} />
            {!compact ? <col style={{ width: "4%" }} /> : null}
            <col style={{ width: compact ? "14%" : "15%" }} />
            <col style={{ width: compact ? "20%" : "20%" }} />
            <col style={{ width: compact ? "11%" : "12%" }} />
            <col style={{ width: compact ? "17%" : "18%" }} />
            <col style={{ width: compact ? "17%" : "15%" }} />
            <col style={{ width: compact ? "10%" : "8%" }} />
            <col style={{ width: compact ? "4%" : "3%" }} />
            <col style={{ width: compact ? "4%" : "3%" }} />
          </colgroup>
          <TableHeader className="bg-[#F5F5F5] [&_th]:h-9 [&_th]:px-1.5 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:text-slate-600">
            <TableRow className="hover:bg-[#F5F5F5]">
              <TableHead className="text-center">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => {
                    if (checked) onSelectAllVisible();
                    else onSelectNone();
                  }}
                  aria-label="Select all visible contacts"
                />
              </TableHead>
              {!compact && <TableHead>#</TableHead>}
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status Pipeline</TableHead>
              <TableHead className="text-center">Follow up</TableHead>
              <TableHead className="text-center">Edit</TableHead>
              <TableHead className="text-center">Menu</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.company || "all"}>
                {groupByCompany ? (
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableCell colSpan={tableColSpan} className="px-2 py-1.5 text-xs font-semibold text-slate-700">
                      {group.company} ({group.items.length})
                    </TableCell>
                  </TableRow>
                ) : null}
                {group.items.map((contact, index) => {
                  const displayName = getDisplayName(contact);
                  const displayEmail = getDisplayEmail(contact);
                  const currentStage = (deriveStageFromContact(contact) || "draft") as PipelineStage;
                  const isSelected = selectedSet.has(contact.id);
                  const isFocused = focusedContactId === contact.id;

                  return (
                    <TableRow
                      key={contact.id}
                      className={`cursor-pointer bg-white hover:bg-slate-50/80 ${
                        isFocused ? "ring-2 ring-inset ring-[#FF7B7B]/30" : ""
                      }`}
                      onClick={() => onOpenContactDetail(contact)}
                    >
                      <TableCell
                        className="px-1 py-1.5 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelectContact(contact.id)}
                          aria-label={`Select ${displayName}`}
                        />
                      </TableCell>
                      {!compact && (
                        <TableCell className="px-1.5 py-1.5 text-xs text-slate-600">{index + 1}</TableCell>
                      )}
                      <TableCell className="px-1.5 py-1.5 text-sm font-medium text-slate-900">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate" title={displayName}>{displayName}</span>
                          {hasReminder(contact) ? (
                            <span title="Reminder set">
                              <BellRing className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-xs text-slate-700">
                        <span className="block truncate" title={contact.role || "-"}>
                          {contact.role || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-xs text-slate-700">
                        <span className="block truncate" title={contact.company || "-"}>
                          {contact.company || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 font-mono text-[11px] text-slate-700">
                        <span className="block truncate" title={displayEmail}>
                          {displayEmail}
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1">
                        <StatusPipeline
                          currentStatus={currentStage}
                          contactId={contact.id}
                          compact={compact}
                          onStatusChange={(nextStatus) => {
                            void handlePipelineStatusChange(contact, nextStatus);
                          }}
                        />
                      </TableCell>
                      <TableCell
                        className="px-1 py-1 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <FollowUpButton onFollowUp={() => handleFollowUp(contact)} />
                      </TableCell>
                      <TableCell
                        className="px-1 py-1 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <EditContactButton onEdit={() => setEditingContact(contact)} />
                      </TableCell>
                      <TableCell
                        className="px-1 py-1 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <MoreActionsButton
                          onViewLinkedIn={() => handleOpenLinkedIn(contact)}
                          onMarkReplied={() => void handleMarkAsReplied(contact)}
                          onMarkNotInterested={() => void handleMarkAsNotInterested(contact)}
                          onAddNote={() => setContactForNote(contact)}
                          onDelete={() => setContactPendingDelete(contact)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
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
