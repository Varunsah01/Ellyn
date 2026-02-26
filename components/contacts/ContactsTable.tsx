"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/dashboard/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  MoreHorizontal,
  Mail,
  KanbanSquare,
  Eye,
  Edit,
  Trash,
  ArrowUpDown,
  Linkedin,
  ExternalLink,
  Briefcase,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useContacts, type Contact as ApiContact } from "@/lib/hooks/useContacts";
import {
  EditContactModal,
  type EditableTrackerContact,
  type EditContactPayload,
} from "@/components/tracker/EditContactModal";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import {
  buildTrackerContactHref,
  saveTrackerDeepLinkContact,
} from "@/lib/tracker-integration";
import { TagsCell } from "@/components/contacts/TagsCell";
import { EmailConfidenceCell } from "@/components/contacts/EmailConfidenceCell";
import { InlineNotesCell } from "@/components/contacts/InlineNotesCell";
import { BulkActionBar } from "@/components/contacts/BulkActionBar";
import { LeadScoreCell } from "@/components/contacts/LeadScoreCell";
import type { LeadScore } from "@/lib/lead-scoring";
import {
  type ContactFilters,
  DEFAULT_FILTERS,
} from "@/components/contacts/FilterPanel";
import { usePersona } from "@/context/PersonaContext";
import { getPersonaCopy } from "@/lib/persona-copy";
import { useAllUserTags } from "@/lib/hooks/useAllUserTags";
import type { Contact } from "@/lib/types/contact";

// Re-export so existing imports from this module keep working
export type { Contact };

// Map local status back to API status for filter comparison
const LOCAL_TO_API_STATUS: Record<Contact["status"], string> = {
  new: "new",
  contacted: "contacted",
  responded: "replied",
  interested: "replied",
  not_interested: "no_response",
};

const API_STATUS_MAP: Record<ApiContact["status"], Contact["status"]> = {
  new: "new",
  contacted: "contacted",
  replied: "responded",
  no_response: "not_interested",
};

function toLocalContact(api: ApiContact): Contact {
  return {
    id: api.id,
    name: api.full_name,
    email: api.confirmed_email ?? api.inferred_email ?? "",
    company: api.company ?? "",
    role: api.role ?? "",
    status: API_STATUS_MAP[api.status],
    lastContact: api.updated_at,
    source: api.source ?? "",
    tags: api.tags ?? [],
    linkedinUrl: api.linkedin_url ?? undefined,
    notes: api.notes ?? "",
    emailConfidence: api.email_confidence,
    emailVerified: api.email_verified,
    emailSource: api.email_source,
    emailPattern: api.email_pattern,
  };
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function applyClientFilters(
  contacts: Contact[],
  filters: ContactFilters
): Contact[] {
  return contacts.filter((c) => {
    if (filters.statuses.length > 0) {
      const apiStatus = LOCAL_TO_API_STATUS[c.status];
      if (!filters.statuses.includes(apiStatus)) return false;
    }

    if (filters.confidenceLevel !== "any") {
      const pct = c.emailConfidence ?? 0;
      if (filters.confidenceLevel === "high" && pct < 80) return false;
      if (
        filters.confidenceLevel === "medium" &&
        (pct < 50 || pct >= 80)
      )
        return false;
      if (filters.confidenceLevel === "low" && pct >= 50) return false;
    }

    if (filters.hasEmail === "with" && !c.email) return false;
    if (filters.hasEmail === "without" && c.email) return false;

    if (filters.tags.length > 0) {
      if (!filters.tags.every((tag) => (c.tags ?? []).includes(tag)))
        return false;
    }

    if (filters.sources.length > 0) {
      if (!filters.sources.includes(c.source)) return false;
    }

    return true;
  });
}

const statusColors = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  responded: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  interested: "bg-green-500/10 text-green-500 border-green-500/20",
  not_interested: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels = {
  new: "New",
  contacted: "Contacted",
  responded: "Responded",
  interested: "Interested",
  not_interested: "No Response",
};

const sourceConfig: Record<string, { label: string; className: string }> = {
  extension: {
    label: "Extension",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  manual: {
    label: "Manual",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
  csv: {
    label: "CSV Import",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  csv_import: {
    label: "CSV Import",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
};

function getSourceConfig(source: string) {
  const key = source.toLowerCase();
  return (
    sourceConfig[key] ?? {
      label: source || "Manual",
      className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    }
  );
}

interface ContactsTableProps {
  search?: string;
  status?: string;
  source?: string;
  filters?: ContactFilters;
}

export function ContactsTable({
  search = "",
  status = "",
  source = "",
  filters = DEFAULT_FILTERS,
}: ContactsTableProps) {
  const router = useRouter();
  const { persona } = usePersona();
  const copy = getPersonaCopy(persona);
  const allUserTags = useAllUserTags();

  const {
    contacts: apiContacts,
    totalCount,
    loading,
    error,
    refresh,
  } = useContacts({ search, status, source });

  // Local mutable contact state (for optimistic updates)
  const [localContacts, setLocalContacts] = useState<Contact[] | null>(null);
  const contacts =
    localContacts ?? apiContacts.map(toLocalContact);

  // Sync when API data changes (e.g. after refresh)
  // We do this by resetting localContacts whenever apiContacts changes
  // (using a callback approach to avoid stale closures)

  const updateContactField = useCallback(
    (id: string, patch: Partial<Contact>) => {
      setLocalContacts((prev) => {
        const base = prev ?? apiContacts.map(toLocalContact);
        return base.map((c) => (c.id === id ? { ...c, ...patch } : c));
      });
    },
    [apiContacts]
  );

  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [leadScores, setLeadScores] = useState<Record<string, LeadScore>>({});

  // Fetch lead scores whenever contacts load (for both personas)
  useEffect(() => {
    if (apiContacts.length === 0) return;
    const ids = apiContacts.map((c) => c.id).join(",");
    void supabaseAuthedFetch(`/api/v1/contacts/lead-scores?ids=${ids}`)
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as Record<string, LeadScore>;
          setLeadScores(data);
        }
      })
      .catch(() => undefined); // non-fatal
  }, [apiContacts]);

  if (loading) return <ListSkeleton count={5} />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">
          Failed to load {copy.contacts.toLowerCase()}. Please try again.
        </p>
        <p className="max-w-xl text-center text-xs text-muted-foreground/80">
          {error}
        </p>
        <Button variant="outline" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const filtered = applyClientFilters(contacts, filters);

  if (filtered.length === 0) {
    const isJobSeeker = persona === "job_seeker";
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          {isJobSeeker ? (
            <Briefcase className="h-7 w-7 text-muted-foreground" />
          ) : (
            <BarChart2 className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{copy.emptyContacts}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {isJobSeeker
              ? "Install the Chrome extension to start saving LinkedIn profiles."
              : "Install the Chrome extension to start capturing LinkedIn prospects."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              "https://chrome.google.com/webstore",
              "_blank",
              "noopener"
            )
          }
        >
          Install Extension
        </Button>
      </div>
    );
  }

  const openInTracker = (contact: Contact) => {
    saveTrackerDeepLinkContact({
      id: contact.id,
      full_name: contact.name,
      company: contact.company,
      role: contact.role,
      inferred_email: contact.email,
      status: contact.status,
    });
    router.push(buildTrackerContactHref(contact.id, { source: "contacts" }));
  };

  const toEditableTrackerContact = (
    contact: Contact | null
  ): EditableTrackerContact | null => {
    if (!contact) return null;
    const { firstName, lastName } = splitFullName(contact.name);
    return {
      id: contact.id,
      full_name: contact.name,
      first_name: firstName || null,
      last_name: lastName || null,
      role: contact.role || null,
      company: contact.company || null,
      inferred_email: contact.email || null,
      linkedin_url: contact.linkedinUrl || null,
      notes: contact.notes || null,
    };
  };

  const handleEditSave = async (payload: EditContactPayload) => {
    if (!editContact) return;
    setIsEditSaving(true);
    try {
      const res = await supabaseAuthedFetch(
        `/api/v1/contacts/${editContact.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: payload.firstName,
            lastName: payload.lastName,
            company: payload.company,
            role: payload.role ?? undefined,
            confirmedEmail: payload.confirmedEmail ?? undefined,
            linkedinUrl: payload.linkedinUrl ?? undefined,
            notes: payload.notes ?? undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      showToast.success(`${copy.contactSingular} updated`);
      setEditOpen(false);
      setEditContact(null);
      setLocalContacts(null);
      await refresh();
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to save"
      );
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteContact) return;
    setIsDeleting(true);
    try {
      const res = await supabaseAuthedFetch(
        `/api/v1/contacts/${deleteContact.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to delete");
      }
      showToast.success(`${copy.contactSingular} deleted`);
      setDeleteOpen(false);
      setDeleteContact(null);
      setLocalContacts(null);
      await refresh();
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to delete"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<Contact>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const contact = row.original;
        const initials = contact.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{contact.name}</div>
              <div className="text-sm text-muted-foreground">
                {contact.role}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <EmailConfidenceCell
            email={c.email}
            confidence={c.emailConfidence}
            verified={c.emailVerified}
            emailSource={c.emailSource}
            emailPattern={c.emailPattern}
          />
        );
      },
    },
    {
      accessorKey: "company",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Company
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.getValue("status") as Contact["status"];
        return (
          <Badge
            variant="outline"
            className={cn("font-medium", statusColors[s])}
          >
            {statusLabels[s]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const src = row.getValue("source") as string;
        const cfg = getSourceConfig(src);
        return (
          <Badge variant="outline" className={cn("font-medium", cfg.className)}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      id: "linkedin",
      header: "LinkedIn",
      cell: ({ row }) => {
        const url = row.original.linkedinUrl;
        if (!url) return null;
        return (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-[#0A66C2] transition-colors hover:text-[#0A66C2]/80"
              title="View LinkedIn profile"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
              title="Open in Extension"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const contact = row.original;
        return (
          <TagsCell
            contactId={contact.id}
            initialTags={contact.tags}
            allUserTags={allUserTags}
            onUpdate={(id, tags) => updateContactField(id, { tags })}
          />
        );
      },
    },
    {
      id: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const contact = row.original;
        return (
          <InlineNotesCell
            contactId={contact.id}
            initialNotes={contact.notes}
            onUpdate={(id, notes) => updateContactField(id, { notes })}
          />
        );
      },
    },
    {
      accessorKey: "lastContact",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Contact
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("lastContact"));
        return <div>{date.toLocaleDateString()}</div>;
      },
    },
    {
      id: "score",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-2"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {persona === "job_seeker" ? "Engagement" : "Score"}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => leadScores[row.id]?.score ?? 0,
      sortingFn: "basic",
      cell: ({ row }) => {
        const score = leadScores[row.original.id];
        if (!score) return null;
        return (
          <LeadScoreCell score={score} isJobSeeker={persona === "job_seeker"} />
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const contact = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(contact.email);
                  showToast.success("Email copied to clipboard");
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Copy email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openInTracker(contact);
                }}
              >
                <KanbanSquare className="mr-2 h-4 w-4" />
                View in Tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/contacts/${contact.id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditContact(contact);
                  setEditOpen(true);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit {copy.contactSingular.toLowerCase()}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteContact(contact);
                  setDeleteOpen(true);
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete {copy.contactSingular.toLowerCase()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      {/* Count heading */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {copy.contacts}{" "}
          <span className="text-foreground">({totalCount})</span>
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(contact) =>
          router.push(`/dashboard/contacts/${contact.id}`)
        }
        onSelectionChange={setSelectedContacts}
      />

      <EditContactModal
        open={editOpen}
        contact={toEditableTrackerContact(editContact)}
        isSaving={isEditSaving}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditContact(null);
        }}
        onSave={(payload) => void handleEditSave(payload)}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteContact(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {copy.contactSingular}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="text-foreground">
              {deleteContact?.name ?? `this ${copy.contactSingular.toLowerCase()}`}
            </strong>
            ? This action cannot be undone.
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
              {isDeleting ? "Deleting..." : `Delete ${copy.contactSingular}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkActionBar
        selected={selectedContacts}
        allUserTags={allUserTags}
        onDeselect={() => setSelectedContacts([])}
        onBulkUpdate={(ids, patch) => {
          if ("_tagPatch" in patch) {
            const tagPatch = patch._tagPatch as Record<string, string[]>;
            setLocalContacts((prev) => {
              const base = prev ?? apiContacts.map(toLocalContact);
              return base.map((c) =>
                ids.includes(c.id) && tagPatch[c.id]
                  ? { ...c, tags: tagPatch[c.id]! }
                  : c
              );
            });
          } else {
            setLocalContacts((prev) => {
              const base = prev ?? apiContacts.map(toLocalContact);
              return base.map((c) =>
                ids.includes(c.id)
                  ? { ...c, ...(patch as Partial<Contact>) }
                  : c
              );
            });
          }
        }}
        onBulkDelete={(ids) => {
          setLocalContacts((prev) => {
            const base = prev ?? apiContacts.map(toLocalContact);
            return base.filter((c) => !ids.includes(c.id));
          });
          setSelectedContacts([]);
        }}
      />
    </>
  );
}
