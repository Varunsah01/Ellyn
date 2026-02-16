"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ContactsTable } from "@/components/tracker/ContactsTable";
import { MobileContactsList } from "@/components/tracker/MobileContactsList";
import { TrackerKanbanBoard } from "@/components/tracker/TrackerKanbanBoard";
import { TrackerHeader } from "@/components/tracker/TrackerHeader";
import { TrackerV2Controls, type TrackerViewMode } from "@/components/tracker/TrackerV2Controls";
import { TrackerBulkActions } from "@/components/tracker/TrackerBulkActions";
import { TrackerAnalyticsPanel } from "@/components/tracker/TrackerAnalyticsPanel";
import { ContactDetailModal } from "@/components/tracker/ContactDetailModal";
import { AddNoteModal } from "@/components/tracker/AddNoteModal";
import { ConfirmDeleteModal } from "@/components/tracker/ConfirmDeleteModal";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, NoResultsState } from "@/components/tracker/TrackerStates";
import { useResponsive } from "@/hooks/useResponsive";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MOCK_TRACKER_CONTACTS } from "@/lib/data/mock-tracker-contacts";
import {
  consumeTrackerDeepLinkContact,
  getTrackerContactIdFromParams,
  toTrackerContact,
} from "@/lib/tracker-integration";
import {
  DEFAULT_EXPORT_COLUMNS,
  DEFAULT_TRACKER_FILTERS,
  TRACKER_SORT_PRESET_LABELS,
  TRACKER_STATUS_LABELS,
  addTimelineEvent,
  applySortPreset,
  applyTrackerFilters,
  buildCompanyCounts,
  computeTrackerAnalytics,
  downloadCsv,
  exportContactsToCsv,
  type TrackerExportColumn,
  type TrackerFilterState,
  type TrackerPreferences,
  type TrackerSortPreset,
  type TrackerStatusFilterValue,
} from "@/lib/tracker-v2";
import type { TrackerContact, TrackerContactStatus } from "@/lib/types/tracker";

const TRACKER_PREFS_KEY = "ellyn:contacts-workspace-preferences";
const TRACKER_CACHE_KEY = "ellyn:contacts-workspace-cache";

function cloneMockContacts(): TrackerContact[] {
  return MOCK_TRACKER_CONTACTS.map((contact) => ({
    ...contact,
    tags: contact.tags ? [...contact.tags] : [],
    timeline: contact.timeline ? [...contact.timeline] : [],
  }));
}

function mapStatusToOutreach(status: TrackerContactStatus): TrackerContact["outreach_status"] {
  switch (status) {
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

function normalizeFiltersFromQuery(params: URLSearchParams): Partial<TrackerFilterState> {
  const statuses = params.get("statuses");
  const companies = params.get("companies");

  return {
    statuses: statuses
      ? statuses.split(",").map((value) => value.trim()).filter(Boolean) as TrackerStatusFilterValue[]
      : undefined,
    companies: companies
      ? companies.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined,
    createdPreset: (params.get("createdPreset") as TrackerFilterState["createdPreset"]) || undefined,
    createdFrom: params.get("createdFrom") || undefined,
    createdTo: params.get("createdTo") || undefined,
    contactedPreset: (params.get("contactedPreset") as TrackerFilterState["contactedPreset"]) || undefined,
    contactedFrom: params.get("contactedFrom") || undefined,
    contactedTo: params.get("contactedTo") || undefined,
    contactedMoreThanDays: params.get("contactedMoreThanDays") || undefined,
    groupByCompany: params.get("groupByCompany") === "1" ? true : undefined,
  };
}

function toQueryString(
  search: string,
  sortPreset: TrackerSortPreset,
  filters: TrackerFilterState,
  viewMode: TrackerViewMode,
  condensed: boolean
) {
  const params = new URLSearchParams();

  if (search.trim()) params.set("q", search.trim());
  if (sortPreset !== "most_recent") params.set("sort", sortPreset);
  if (filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","));
  if (filters.companies.length > 0) params.set("companies", filters.companies.join(","));
  if (filters.createdPreset !== "all") params.set("createdPreset", filters.createdPreset);
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.contactedPreset !== "all") params.set("contactedPreset", filters.contactedPreset);
  if (filters.contactedFrom) params.set("contactedFrom", filters.contactedFrom);
  if (filters.contactedTo) params.set("contactedTo", filters.contactedTo);
  if (filters.contactedMoreThanDays) params.set("contactedMoreThanDays", filters.contactedMoreThanDays);
  if (filters.groupByCompany) params.set("groupByCompany", "1");
  if (viewMode !== "table") params.set("view", viewMode);
  if (condensed) params.set("condensed", "1");

  return params.toString();
}

export default function ContactsWorkspace() {
  const { isMobile, isTablet } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initializedFromQueryRef = useRef(false);
  const openedFromQueryRef = useRef<string | null>(null);

  const [contacts, setContacts] = useState<TrackerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortPreset, setSortPreset] = useState<TrackerSortPreset>("most_recent");
  const [filters, setFilters] = useState<TrackerFilterState>(DEFAULT_TRACKER_FILTERS);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<TrackerExportColumn[]>(DEFAULT_EXPORT_COLUMNS);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [focusedContactId, setFocusedContactId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<TrackerViewMode>("table");
  const [condensedView, setCondensedView] = useState(false);
  const [mobileHeaderCondensed, setMobileHeaderCondensed] = useState(false);
  const [isNarrowDesktop, setIsNarrowDesktop] = useState(false);
  const [bulkNoteModalOpen, setBulkNoteModalOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [pendingContactIdFromQuery, setPendingContactIdFromQuery] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(TRACKER_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as TrackerContact[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContacts(parsed);
          setLoading(false);
        }
      }
    } catch {
      // Cache hydration is best effort.
    }

    const timer = window.setTimeout(() => {
      try {
        const fresh = cloneMockContacts();
        setContacts(fresh);
        window.localStorage.setItem(TRACKER_CACHE_KEY, JSON.stringify(fresh));
        setError(null);
      } catch {
        setError("Unable to load contacts.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (contacts.length === 0) return;
    try {
      window.localStorage.setItem(TRACKER_CACHE_KEY, JSON.stringify(contacts));
    } catch {
      // Cache persistence is best effort.
    }
  }, [contacts]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TRACKER_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TrackerPreferences>;

      if (parsed.sortPreset && parsed.sortPreset in TRACKER_SORT_PRESET_LABELS) {
        setSortPreset(parsed.sortPreset);
      }
      if (parsed.filters) {
        setFilters((prev) => ({ ...prev, ...parsed.filters }));
      }
      if (Array.isArray(parsed.exportColumns) && parsed.exportColumns.length > 0) {
        setExportColumns(parsed.exportColumns as TrackerExportColumn[]);
      }
      if (parsed.viewMode === "table" || parsed.viewMode === "kanban") {
        setViewMode(parsed.viewMode);
      }
      if (typeof parsed.condensed === "boolean") {
        setCondensedView(parsed.condensed);
      }
      if (typeof parsed.showAnalytics === "boolean") {
        setShowAnalytics(parsed.showAnalytics);
      }
    } catch {
      // Preferences are best effort.
    }
  }, []);

  useEffect(() => {
    if (initializedFromQueryRef.current) return;
    initializedFromQueryRef.current = true;

    const querySearch = searchParams.get("q");
    const querySort = searchParams.get("sort") as TrackerSortPreset | null;
    const queryView = searchParams.get("view");
    const queryCondensed = searchParams.get("condensed");
    const queryFilters = normalizeFiltersFromQuery(searchParams);

    if (querySearch != null) {
      setSearchQuery(querySearch);
      setDebouncedSearchQuery(querySearch);
    }
    if (querySort && querySort in TRACKER_SORT_PRESET_LABELS) {
      setSortPreset(querySort);
    }
    if (queryView === "table" || queryView === "kanban") {
      setViewMode(queryView);
    }
    if (queryCondensed === "1") {
      setCondensedView(true);
    }
    setFilters((prev) => ({ ...prev, ...queryFilters }));
  }, [searchParams]);

  useEffect(() => {
    const preferences: TrackerPreferences = {
      sortPreset,
      filters,
      exportColumns,
      viewMode,
      condensed: condensedView,
      showAnalytics,
    };
    window.localStorage.setItem(TRACKER_PREFS_KEY, JSON.stringify(preferences));
  }, [sortPreset, filters, exportColumns, viewMode, condensedView, showAnalytics]);

  useEffect(() => {
    if (!initializedFromQueryRef.current) return;
    const query = toQueryString(debouncedSearchQuery, sortPreset, filters, viewMode, condensedView);
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [debouncedSearchQuery, filters, pathname, router, sortPreset, viewMode, condensedView]);

  useEffect(() => {
    const requestedContactId = getTrackerContactIdFromParams(searchParams);
    if (!requestedContactId) return;
    setPendingContactIdFromQuery(requestedContactId);
  }, [searchParams]);

  useEffect(() => {
    if (!pendingContactIdFromQuery) return;
    if (openedFromQueryRef.current === pendingContactIdFromQuery) return;

    const exists = contacts.some((contact) => contact.id === pendingContactIdFromQuery);
    if (!exists) {
      const deepLinkedContact = consumeTrackerDeepLinkContact(pendingContactIdFromQuery);
      if (!deepLinkedContact) return;
      setContacts((prev) => {
        if (prev.some((contact) => contact.id === pendingContactIdFromQuery)) {
          return prev;
        }
        return [toTrackerContact(deepLinkedContact), ...prev];
      });
    }

    openedFromQueryRef.current = pendingContactIdFromQuery;
    setFocusedContactId(pendingContactIdFromQuery);
    setDetailContactId(pendingContactIdFromQuery);
    setPendingContactIdFromQuery(null);
  }, [contacts, pendingContactIdFromQuery]);

  const filteredContacts = useMemo(
    () => applyTrackerFilters(contacts, debouncedSearchQuery, filters),
    [contacts, debouncedSearchQuery, filters]
  );
  const sortedContacts = useMemo(
    () => applySortPreset(filteredContacts, sortPreset),
    [filteredContacts, sortPreset]
  );
  const visibleContacts = sortedContacts;
  const companyOptions = useMemo(() => buildCompanyCounts(contacts), [contacts]);
  const analytics = useMemo(() => computeTrackerAnalytics(visibleContacts), [visibleContacts]);
  const detailContact = useMemo(
    () => visibleContacts.find((contact) => contact.id === detailContactId) || contacts.find((contact) => contact.id === detailContactId) || null,
    [contacts, detailContactId, visibleContacts]
  );

  useEffect(() => {
    if (visibleContacts.length === 0) {
      setFocusedContactId(null);
      return;
    }

    if (!focusedContactId || !visibleContacts.some((contact) => contact.id === focusedContactId)) {
      setFocusedContactId(visibleContacts[0].id);
    }
  }, [focusedContactId, visibleContacts]);

  useEffect(() => {
    setSelectedContactIds((prev) => prev.filter((id) => visibleContacts.some((contact) => contact.id === id)));
  }, [visibleContacts]);

  const refresh = async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    setContacts((prev) => [...prev]);
  };

  const updateContact = async (contactId: string, updates: Partial<TrackerContact>) => {
    setContacts((prev) =>
      prev.map((contact) => {
        if (contact.id !== contactId) return contact;

        const next: TrackerContact = {
          ...contact,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        if (updates.status && updates.status !== contact.status) {
          next.timeline = addTimelineEvent(
            next,
            updates.status === "replied" ? "replied" : "status_changed",
            updates.status === "replied" ? "Reply received" : `Status changed to ${updates.status}`
          );
        }

        if (updates.outreach_status && updates.outreach_status !== contact.outreach_status) {
          if (updates.outreach_status === "sent") {
            next.timeline = addTimelineEvent(next, "email_sent", "Email sent");
            next.last_contacted_at = updates.last_contacted_at || new Date().toISOString();
          }
        }

        if ("notes" in updates && updates.notes !== contact.notes) {
          next.timeline = addTimelineEvent(next, "note_added", "Note updated");
        }

        if ("reminder_at" in updates && updates.reminder_at !== contact.reminder_at) {
          next.timeline = addTimelineEvent(next, "reminder_set", "Reminder set");
        }

        if (updates.status === "contacted" && !updates.last_contacted_at) {
          next.last_contacted_at = new Date().toISOString();
        }

        return next;
      })
    );
  };

  const deleteContact = async (contactId: string) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
    setSelectedContactIds((prev) => prev.filter((id) => id !== contactId));
    if (detailContactId === contactId) {
      setDetailContactId(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  const createNewContact = () => {
    const nowIso = new Date().toISOString();
    const id = `trk-${Date.now()}`;
    const newContact: TrackerContact = {
      id,
      first_name: "New",
      last_name: "Contact",
      full_name: "New Contact",
      company: "Unknown",
      role: "Unknown",
      inferred_email: "",
      confirmed_email: null,
      status: "new",
      outreach_status: "draft",
      notes: "",
      tags: [],
      created_at: nowIso,
      updated_at: nowIso,
      timeline: [
        {
          id: `${id}-draft`,
          type: "draft_created",
          title: "Draft created",
          created_at: nowIso,
        },
      ],
    };

    setContacts((prev) => [newContact, ...prev]);
    setFocusedContactId(id);
    setDetailContactId(id);
    toast.success("New contact added.");
  };

  const handleSelectAllVisible = () => {
    setSelectedContactIds(visibleContacts.map((contact) => contact.id));
  };

  const handleSelectNone = () => {
    setSelectedContactIds([]);
  };

  const handleToggleSelectContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      if (prev.includes(contactId)) {
        return prev.filter((id) => id !== contactId);
      }
      return [...prev, contactId];
    });
  };

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [contacts, selectedContactIds]
  );

  const handleBulkStatusUpdate = (status: TrackerContactStatus) => {
    if (selectedContactIds.length === 0) return;
    const outreachStatus = mapStatusToOutreach(status);

    setContacts((prev) =>
      prev.map((contact) => {
        if (!selectedContactIds.includes(contact.id)) return contact;
        const updated = {
          ...contact,
          status,
          outreach_status: outreachStatus,
          updated_at: new Date().toISOString(),
          last_contacted_at:
            status === "contacted" ? new Date().toISOString() : contact.last_contacted_at,
        };
        updated.timeline = addTimelineEvent(
          updated,
          status === "replied" ? "replied" : "status_changed",
          status === "replied" ? "Reply received" : `Bulk status set to ${status}`
        );
        return updated;
      })
    );

    toast.success(`Updated ${selectedContactIds.length} contacts.`);
  };

  const handleBulkDelete = () => {
    if (selectedContactIds.length === 0) return;
    const isSelectingAllVisible = selectedContactIds.length === visibleContacts.length && visibleContacts.length > 0;
    if (isSelectingAllVisible) {
      setBulkDeleteConfirmOpen(true);
      return;
    }

    setContacts((prev) => prev.filter((contact) => !selectedContactIds.includes(contact.id)));
    setSelectedContactIds([]);
    toast.success("Deleted selected contacts.");
  };

  const confirmBulkDeleteAllVisible = async () => {
    setIsBulkDeleting(true);
    setContacts((prev) => prev.filter((contact) => !selectedContactIds.includes(contact.id)));
    setSelectedContactIds([]);
    setBulkDeleteConfirmOpen(false);
    setIsBulkDeleting(false);
    toast.success("Deleted selected contacts.");
  };

  const [bulkNoteDraft, setBulkNoteDraft] = useState("");
  const handleBulkAddNote = () => {
    if (selectedContactIds.length === 0) return;
    setBulkNoteDraft("");
    setBulkNoteModalOpen(true);
  };

  const saveBulkNote = async (note: string) => {
    const trimmed = note.trim();
    if (!trimmed || selectedContactIds.length === 0) {
      setBulkNoteModalOpen(false);
      return;
    }

    setContacts((prev) =>
      prev.map((contact) => {
        if (!selectedContactIds.includes(contact.id)) return contact;
        const current = (contact.notes || "").trim();
        const nextNotes = current ? `${current}\n${trimmed}` : trimmed;
        const updated: TrackerContact = {
          ...contact,
          notes: nextNotes,
          updated_at: new Date().toISOString(),
        };
        updated.timeline = addTimelineEvent(updated, "note_added", "Bulk note added", trimmed);
        return updated;
      })
    );

    setBulkNoteModalOpen(false);
    toast.success(`Added note to ${selectedContactIds.length} contacts.`);
  };

  const handleExport = (contactsToExport: TrackerContact[], fileTag: string) => {
    if (contactsToExport.length === 0) {
      toast.error("No contacts to export.");
      return;
    }
    if (exportColumns.length === 0) {
      toast.error("Choose at least one export column.");
      return;
    }
    const csv = exportContactsToCsv(contactsToExport, exportColumns);
    const dateLabel = new Date().toISOString().slice(0, 10);
    downloadCsv(`ellyn-contacts-${fileTag}-${dateLabel}.csv`, csv);
    toast.success("CSV exported.");
  };

  const handleExportSelected = () => {
    handleExport(selectedContacts, "selected");
  };

  const removeFilterChip = (chipKey: string) => {
    if (chipKey === "search") {
      clearSearch();
      return;
    }

    if (chipKey.startsWith("status:")) {
      const value = chipKey.replace("status:", "") as TrackerStatusFilterValue;
      setFilters((prev) => ({
        ...prev,
        statuses: prev.statuses.filter((status) => status !== value),
      }));
      return;
    }

    if (chipKey.startsWith("company:")) {
      const value = chipKey.replace("company:", "");
      setFilters((prev) => ({
        ...prev,
        companies: prev.companies.filter((company) => company !== value),
      }));
      return;
    }

    if (chipKey === "created-range") {
      setFilters((prev) => ({ ...prev, createdFrom: "", createdTo: "", createdPreset: "all" }));
      return;
    }

    if (chipKey === "contacted-range") {
      setFilters((prev) => ({
        ...prev,
        contactedFrom: "",
        contactedTo: "",
        contactedPreset: "all",
        contactedMoreThanDays: "",
      }));
      return;
    }

    if (chipKey === "group-by-company") {
      setFilters((prev) => ({ ...prev, groupByCompany: false }));
    }
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];

    if (debouncedSearchQuery.trim()) {
      chips.push({ key: "search", label: `Search: ${debouncedSearchQuery.trim()}` });
    }

    for (const status of filters.statuses) {
      chips.push({
        key: `status:${status}`,
        label: TRACKER_STATUS_LABELS[status],
      });
    }

    for (const company of filters.companies) {
      chips.push({ key: `company:${company}`, label: company });
    }

    if (filters.createdFrom || filters.createdTo || filters.createdPreset !== "all") {
      chips.push({ key: "created-range", label: "Created date filter" });
    }

    if (
      filters.contactedFrom ||
      filters.contactedTo ||
      filters.contactedPreset !== "all" ||
      filters.contactedMoreThanDays
    ) {
      chips.push({ key: "contacted-range", label: "Last contacted filter" });
    }

    if (filters.groupByCompany) {
      chips.push({ key: "group-by-company", label: "Grouped by company" });
    }

    return chips;
  }, [debouncedSearchQuery, filters]);

  const clearAllFilters = () => {
    setFilters(DEFAULT_TRACKER_FILTERS);
    clearSearch();
  };

  const handleMoveFocus = useCallback((direction: 1 | -1) => {
    if (visibleContacts.length === 0) return;
    const currentIndex = visibleContacts.findIndex((contact) => contact.id === focusedContactId);
    const nextIndex = currentIndex < 0 ? 0 : Math.min(visibleContacts.length - 1, Math.max(0, currentIndex + direction));
    setFocusedContactId(visibleContacts[nextIndex].id);
  }, [focusedContactId, visibleContacts]);

  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      callback: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      key: "k",
      meta: true,
      callback: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      key: "f",
      ctrl: true,
      callback: () => {
        setFiltersOpen((prev) => !prev);
      },
    },
    {
      key: "f",
      meta: true,
      callback: () => {
        setFiltersOpen((prev) => !prev);
      },
    },
    {
      key: "n",
      ctrl: true,
      callback: () => {
        createNewContact();
      },
    },
    {
      key: "n",
      meta: true,
      callback: () => {
        createNewContact();
      },
    },
    {
      key: "Escape",
      callback: () => {
        setFiltersOpen(false);
        setDetailContactId(null);
        setBulkNoteModalOpen(false);
      },
    },
  ]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isInput) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        handleMoveFocus(1);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        handleMoveFocus(-1);
        return;
      }
      if (event.key === "Enter") {
        if (!focusedContactId) return;
        const contact = visibleContacts.find((item) => item.id === focusedContactId);
        if (!contact) return;
        event.preventDefault();
        setDetailContactId(contact.id);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedContactId, handleMoveFocus, visibleContacts]);

  useEffect(() => {
    if (!isMobile) {
      setMobileHeaderCondensed(false);
      return;
    }

    const handleScroll = () => {
      setMobileHeaderCondensed(window.scrollY > 110);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  useEffect(() => {
    const syncDesktopDensity = () => {
      const width = window.innerWidth;
      setIsNarrowDesktop(width >= 1024 && width < 1360);
    };

    syncDesktopDensity();
    window.addEventListener("resize", syncDesktopDensity);

    return () => {
      window.removeEventListener("resize", syncDesktopDensity);
    };
  }, []);

  const hasActiveSearchOrFilters = debouncedSearchQuery.trim().length > 0 || activeFilterChips.length > 0;
  const shouldShowBottomSummary =
    !loading &&
    !error &&
    contacts.length > 0 &&
    !(hasActiveSearchOrFilters && visibleContacts.length === 0) &&
    (isMobile || viewMode === "table");
  const shouldUseCompactTable = isTablet || isNarrowDesktop;

  return (
    <DashboardShell breadcrumbs={[{ label: "Contacts" }]} className="space-y-4">
      <div className="space-y-4 pb-4">
        <div className="sticky top-16 z-30 space-y-3 border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-5 2xl:px-6 dark:border-slate-800 dark:bg-slate-950/90">
          <TrackerHeader
            title="Contacts"
            searchPlaceholder="Search by name, company, title, or email"
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            compact={mobileHeaderCondensed}
            onSearchChange={(value) => {
              setSearchQuery(value);
              if (!value.trim()) {
                setDebouncedSearchQuery("");
              }
            }}
            onCreateContact={createNewContact}
          />

          <TrackerV2Controls
            sortPreset={sortPreset}
            onSortPresetChange={setSortPreset}
            filters={filters}
            onFiltersChange={setFilters}
            companyOptions={companyOptions}
            activeFilterChips={activeFilterChips}
            onRemoveFilterChip={removeFilterChip}
            onClearAllFilters={clearAllFilters}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            isMobile={isMobile}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            condensed={condensedView}
            onCondensedChange={setCondensedView}
          />

          <TrackerBulkActions
            selectedCount={selectedContactIds.length}
            totalVisibleCount={visibleContacts.length}
            onSelectAll={handleSelectAllVisible}
            onSelectNone={handleSelectNone}
            onBulkStatusUpdate={handleBulkStatusUpdate}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleExportSelected}
            onBulkAddNote={handleBulkAddNote}
          />

          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-slate-100"
              onClick={() => setShowAnalytics((prev) => !prev)}
            >
              {showAnalytics ? "Hide analytics" : "Show analytics"}
            </button>
          </div>
        </div>

        {showAnalytics ? <TrackerAnalyticsPanel analytics={analytics} /> : null}

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setContacts(cloneMockContacts());
              setLoading(false);
            }}
          />
        ) : contacts.length === 0 ? (
          <EmptyState />
        ) : hasActiveSearchOrFilters && visibleContacts.length === 0 ? (
          <NoResultsState
            searchQuery={debouncedSearchQuery.trim() || "active filters"}
            onClearSearch={clearSearch}
          />
        ) : isMobile ? (
          <MobileContactsList
            contacts={visibleContacts}
            onRefresh={refresh}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            selectedContactIds={selectedContactIds}
            onToggleSelectContact={handleToggleSelectContact}
            onSelectNone={handleSelectNone}
            onOpenContactDetail={(contact) => setDetailContactId(contact.id)}
            focusedContactId={focusedContactId}
          />
        ) : viewMode === "kanban" ? (
          <TrackerKanbanBoard
            contacts={visibleContacts}
            selectedContactIds={selectedContactIds}
            onToggleSelectContact={handleToggleSelectContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            onOpenContactDetail={(contact) => setDetailContactId(contact.id)}
            focusedContactId={focusedContactId}
            condensed={condensedView}
          />
        ) : (
          <ContactsTable
            contacts={visibleContacts}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            selectedContactIds={selectedContactIds}
            onToggleSelectContact={handleToggleSelectContact}
            onSelectAllVisible={handleSelectAllVisible}
            onSelectNone={handleSelectNone}
            onOpenContactDetail={(contact) => setDetailContactId(contact.id)}
            focusedContactId={focusedContactId}
            groupByCompany={filters.groupByCompany}
            compact={shouldUseCompactTable}
          />
        )}

        {shouldShowBottomSummary ? (
          <div className="border-y border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:px-4 lg:px-5 2xl:px-6 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            Showing {visibleContacts.length} of {contacts.length} contacts
          </div>
        ) : null}
      </div>

      {isMobile ? (
        <Button
          type="button"
          className="fixed bottom-6 right-5 z-40 h-14 min-w-14 rounded-full bg-[#FF7B7B] px-4 text-white shadow-lg hover:bg-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40"
          onClick={createNewContact}
          aria-label="Add new contact"
        >
          <Plus className="h-5 w-5" />
        </Button>
      ) : null}

      <ContactDetailModal
        open={Boolean(detailContact)}
        contact={detailContact}
        onOpenChange={(open) => {
          if (!open) {
            setDetailContactId(null);
          }
        }}
        onSave={updateContact}
      />

      <AddNoteModal
        open={bulkNoteModalOpen}
        contactName={`${selectedContactIds.length} selected contacts`}
        initialNote={bulkNoteDraft}
        isSaving={false}
        onCancel={() => setBulkNoteModalOpen(false)}
        onSave={saveBulkNote}
      />

      <ConfirmDeleteModal
        open={bulkDeleteConfirmOpen}
        contactName="all selected contacts"
        isDeleting={isBulkDeleting}
        title="Delete all selected contacts?"
        description={
          <>
            You selected all visible contacts. This will permanently remove{" "}
            <strong>{selectedContactIds.length}</strong> contacts from your workspace.
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete All"
        onCancel={() => {
          if (isBulkDeleting) return;
          setBulkDeleteConfirmOpen(false);
        }}
        onConfirm={confirmBulkDeleteAllVisible}
      />

    </DashboardShell>
  );
}
