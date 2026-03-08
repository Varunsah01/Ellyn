
"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  MailSearch,
  MoreHorizontal,
  Plus,
} from "lucide-react";

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
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";

type ContactStatus = "new" | "contacted" | "replied" | "no_response";
type StatusFilter = "all" | ContactStatus;

type Contact = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  confirmed_email: string | null;
  inferred_email: string | null;
  company: string | null;
  role: string | null;
  status: ContactStatus;
  source: string | null;
  linkedin_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  lead_score_cache: number | null;
  lead_score_grade: "hot" | "warm" | "cold" | null;
};

type ContactsResponse = {
  success?: boolean;
  contacts: Contact[];
  total?: number;
  totalCount?: number;
  pages?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ContactUpsertForm = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  role: string;
  linkedin_url: string;
  status: ContactStatus;
};

const PAGE_SIZE = 20;

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "no_response", label: "No Response" },
];

const CONTACT_STATUSES: ContactStatus[] = ["new", "contacted", "replied", "no_response"];

const DEFAULT_FORM: ContactUpsertForm = {
  first_name: "",
  last_name: "",
  email: "",
  company: "",
  role: "",
  linkedin_url: "",
  status: "new",
};

function toStatusLabel(status: ContactStatus): string {
  if (status === "new") return "New";
  if (status === "contacted") return "Contacted";
  if (status === "no_response") return "No Response";
  return "Replied";
}

function statusClassName(status: ContactStatus): string {
  if (status === "contacted") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "no_response") return "border-red-200 bg-red-50 text-red-700";
  if (status === "replied") return "border-green-200 bg-green-50 text-green-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function displayName(contact: Contact): string {
  const first = contact.first_name?.trim() ?? "";
  const last = contact.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || "Unknown";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function gradeClassName(grade: "hot" | "warm" | "cold"): string {
  if (grade === "hot") return "border-red-200 bg-red-50 text-red-700";
  if (grade === "warm") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function normalizeSource(value: string | null): string {
  if (!value) return "Manual";
  const cleaned = value.replace(/_/g, " ").trim();
  if (!cleaned) return "Manual";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getPrimaryEmail(contact: Pick<Contact, "confirmed_email" | "inferred_email">): string | null {
  return contact.confirmed_email || contact.inferred_email || null;
}

function buildContactPayload(form: ContactUpsertForm) {
  return {
    firstName: form.first_name.trim(),
    lastName: form.last_name.trim(),
    confirmedEmail: form.email.trim() || undefined,
    company: form.company.trim(),
    role: form.role.trim() || undefined,
    linkedinUrl: form.linkedin_url.trim() || undefined,
    status: form.status,
  };
}

function toOffset(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

function getCount(counts: Record<StatusFilter, number>, status: StatusFilter): number {
  return counts[status] ?? 0;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({
    all: 0,
    new: 0,
    contacted: 0,
    replied: 0,
    no_response: 0,
  });

  const [refreshNonce, setRefreshNonce] = useState(0);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState<ContactUpsertForm>(DEFAULT_FORM);

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<ContactUpsertForm>(DEFAULT_FORM);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeStatus]);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      setAuthUserId(user?.id ?? null);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUserId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`contacts-live-${authUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
          filter: `user_id=eq.${authUserId}`,
        },
        () => {
          setRefreshNonce((value) => value + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUserId]);
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
        sortBy: "created_at",
        sortDir: "desc",
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      if (activeStatus !== "all") {
        params.set("status", activeStatus);
      }

      const response = await fetch(`/api/v1/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      const raw = (await response.json().catch(() => ({}))) as
        | ContactsResponse
        | { error?: string; data?: ContactsResponse };
      const data =
        raw && typeof raw === "object" && "data" in raw && raw.data
          ? raw.data
          : raw;

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch contacts");
      }

      const payload = data as ContactsResponse;
      setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
      const nextTotal =
        typeof payload.totalCount === "number"
          ? payload.totalCount
          : typeof payload.pagination?.total === "number"
            ? payload.pagination.total
            : typeof payload.total === "number"
              ? payload.total
              : 0;
      const totalPages =
        typeof payload.pagination?.totalPages === "number"
          ? payload.pagination.totalPages
          : typeof payload.pages === "number"
            ? payload.pages
            : Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));

      setTotal(nextTotal);
      setHasMore(page < totalPages);
      setSelectedIds(new Set());
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to fetch contacts");
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus, debouncedSearch, page]);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const baseParams = new URLSearchParams({
        limit: "1",
        page: "1",
      });
      if (debouncedSearch) {
        baseParams.set("search", debouncedSearch);
      }

      const tabsWithoutAll = STATUS_TABS.filter((tab) => tab.key !== "all");

      const responses = await Promise.all(
        tabsWithoutAll.map(async (tab) => {
          const params = new URLSearchParams(baseParams);
          params.set("status", tab.key);
          const response = await fetch(`/api/v1/contacts?${params.toString()}`, { cache: "no-store" });
          const raw = (await response.json().catch(() => ({}))) as
            | ContactsResponse
            | { error?: string; data?: ContactsResponse };
          const data =
            raw && typeof raw === "object" && "data" in raw && raw.data
              ? raw.data
              : raw;
          if (!response.ok) {
            throw new Error((data as { error?: string }).error || "Failed to fetch status counts");
          }
          const payload = data as ContactsResponse;
          return {
            key: tab.key,
            total:
              payload.totalCount ??
              payload.pagination?.total ??
              payload.total ??
              0,
          };
        })
      );

      const allResponse = await fetch(`/api/v1/contacts?${baseParams.toString()}`, {
        cache: "no-store",
      });
      const allRaw = (await allResponse.json().catch(() => ({}))) as
        | ContactsResponse
        | { error?: string; data?: ContactsResponse };
      const allData =
        allRaw && typeof allRaw === "object" && "data" in allRaw && allRaw.data
          ? allRaw.data
          : allRaw;
      if (!allResponse.ok) {
        throw new Error((allData as { error?: string }).error || "Failed to fetch status counts");
      }

      const nextCounts: Record<StatusFilter, number> = {
        all:
          (allData as ContactsResponse).totalCount ??
          (allData as ContactsResponse).pagination?.total ??
          (allData as ContactsResponse).total ??
          0,
        new: 0,
        contacted: 0,
        replied: 0,
        no_response: 0,
      };

      for (const item of responses) {
        nextCounts[item.key] = item.total;
      }

      setStatusCounts(nextCounts);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to fetch status counts");
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts, refreshNonce]);

  useEffect(() => {
    void fetchStatusCounts();
  }, [fetchStatusCounts, refreshNonce]);

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      showToast.success("Email copied");
    } catch {
      showToast.error("Failed to copy email");
    }
  };

  const handleExportCsv = () => {
    window.location.href = "/api/v1/contacts/export";
  };

  const handleAddContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!addForm.first_name.trim() || !addForm.last_name.trim() || !addForm.company.trim()) {
      showToast.error("First name, last name, and company are required");
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const response = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactPayload(addForm)),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to create contact");
      }

      showToast.success("Contact created");
      setIsAddModalOpen(false);
      setAddForm(DEFAULT_FORM);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to create contact");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const openEditDrawer = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: getPrimaryEmail(contact) ?? "",
      company: contact.company ?? "",
      role: contact.role ?? "",
      linkedin_url: contact.linkedin_url ?? "",
      status: contact.status ?? "new",
    });
  };

  const handleEditContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingContact) return;

    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.company.trim()) {
      showToast.error("First name, last name, and company are required");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const response = await fetch(`/api/v1/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactPayload(editForm)),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update contact");
      }

      showToast.success("Contact updated");
      setEditingContact(null);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update contact");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleQuickStatusChange = async (contact: Contact, status: ContactStatus) => {
    try {
      const response = await fetch(`/api/v1/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      showToast.success("Status updated");
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/contacts/${contactToDelete.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete contact");
      }

      showToast.success("Contact deleted");
      setContactToDelete(null);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete contact");
    } finally {
      setIsDeleting(false);
    }
  };

  const allVisibleSelected =
    contacts.length > 0 && contacts.every((contact) => selectedIds.has(contact.id));
  const someVisibleSelected =
    contacts.length > 0 && contacts.some((contact) => selectedIds.has(contact.id));

  const headerCheckboxState: CheckedState = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  const rangeStart = total === 0 ? 0 : toOffset(page) + 1;
  const rangeEnd = total === 0 ? 0 : toOffset(page) + contacts.length;

  const selectedCount = selectedIds.size;

  const headerActions = useMemo(
    () => (
      <>
        <Badge variant="secondary" className="h-8 rounded-full px-3">
          {total}
        </Badge>
        <Button type="button" variant="outline" onClick={handleExportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button type="button" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </>
    ),
    [total]
  );

  return (
    <DashboardShell>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Contacts"
          description="Manage your discovered contacts and outreach statuses."
          actions={headerActions}
        />

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <MailSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or company"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STATUS_TABS.map((tab) => (
                <Button
                  key={tab.key}
                  type="button"
                  variant={activeStatus === tab.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveStatus(tab.key)}
                >
                  {tab.label}
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">
                    {getCount(statusCounts, tab.key)}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {total}
            </p>
            {selectedCount > 0 ? (
              <p className="text-sm text-muted-foreground">{selectedCount} selected</p>
            ) : null}
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<MailSearch className="h-7 w-7" />}
                title="Your contact list is empty"
                description="Start by finding an email on the dashboard."
                action={{
                  label: "Go to Dashboard",
                  onClick: () => {
                    window.location.href = "/dashboard";
                  },
                }}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={(value) => {
                        if (value === true) {
                          setSelectedIds(new Set(contacts.map((contact) => contact.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[56px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const primaryEmail = getPrimaryEmail(contact);
                  const rowChecked = selectedIds.has(contact.id);
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={rowChecked}
                          onCheckedChange={(value) => {
                            setSelectedIds((previous) => {
                              const next = new Set(previous);
                              if (value === true) {
                                next.add(contact.id);
                              } else {
                                next.delete(contact.id);
                              }
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{displayName(contact)}</TableCell>
                      <TableCell>
                        {primaryEmail ? (
                          <div className="flex items-center gap-2">
                            <span className="max-w-[220px] truncate">{primaryEmail}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => void handleCopyEmail(primaryEmail)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{contact.company || "-"}</TableCell>
                      <TableCell>{contact.role || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusClassName(
                            contact.status
                          )}`}
                        >
                          {toStatusLabel(contact.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {contact.lead_score_grade ? (
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${gradeClassName(contact.lead_score_grade)}`}>
                            {contact.lead_score_grade.charAt(0).toUpperCase() + contact.lead_score_grade.slice(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>{normalizeSource(contact.source)}</TableCell>
                      <TableCell>{formatDate(contact.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDrawer(contact)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {CONTACT_STATUSES.map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() => void handleQuickStatusChange(contact, status)}
                                  >
                                    {toStatusLabel(status)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setContactToDelete(contact)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {rangeStart}-{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasMore || isLoading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setAddForm(DEFAULT_FORM);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to your outreach workspace.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleAddContact(event)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="add-first-name" className="text-sm font-medium">
                  First Name
                </label>
                <Input
                  id="add-first-name"
                  value={addForm.first_name}
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, first_name: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="add-last-name" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="add-last-name"
                  value={addForm.last_name}
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, last_name: event.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="add-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="add-company" className="text-sm font-medium">
                Company
              </label>
              <Input
                id="add-company"
                value={addForm.company}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, company: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="add-role" className="text-sm font-medium">
                Role
              </label>
              <Input
                id="add-role"
                value={addForm.role}
                onChange={(event) => setAddForm((prev) => ({ ...prev, role: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="add-linkedin" className="text-sm font-medium">
                LinkedIn URL
              </label>
              <Input
                id="add-linkedin"
                type="url"
                value={addForm.linkedin_url}
                onChange={(event) =>
                  setAddForm((prev) => ({ ...prev, linkedin_url: event.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingAdd}>
                {isSubmittingAdd ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmittingAdd ? "Saving..." : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(editingContact)} onOpenChange={(open) => !open && setEditingContact(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Contact</SheetTitle>
            <SheetDescription>Update contact details and status.</SheetDescription>
          </SheetHeader>

          <form className="mt-5 space-y-4" onSubmit={(event) => void handleEditContact(event)}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-first-name" className="text-sm font-medium">
                  First Name
                </label>
                <Input
                  id="edit-first-name"
                  value={editForm.first_name}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, first_name: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="edit-last-name" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="edit-last-name"
                  value={editForm.last_name}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, last_name: event.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-company" className="text-sm font-medium">
                Company
              </label>
              <Input
                id="edit-company"
                value={editForm.company}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, company: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-role" className="text-sm font-medium">
                Role
              </label>
              <Input
                id="edit-role"
                value={editForm.role}
                onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-linkedin" className="text-sm font-medium">
                LinkedIn URL
              </label>
              <Input
                id="edit-linkedin"
                type="url"
                value={editForm.linkedin_url}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, linkedin_url: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, status: value as ContactStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmittingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(contactToDelete)}
        onOpenChange={(open: boolean) => !open && setContactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contact will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                void handleDeleteContact();
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
