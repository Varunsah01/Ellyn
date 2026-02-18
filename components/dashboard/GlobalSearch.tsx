"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Search,
  Users,
  Mail,
  FileText,
  Plus,
  Command,
  Home,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "contact" | "sequence" | "template" | "action" | "page";
  title: string;
  subtitle?: string;
  url?: string;
  action?: () => void;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Render the GlobalSearch component.
 * @param {GlobalSearchProps} props - Component props.
 * @returns {unknown} JSX output for GlobalSearch.
 * @example
 * <GlobalSearch />
 */
export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // ── Static items: actions + pages only ─────────────────────────────────────
  const staticItems = useMemo<SearchResult[]>(() => [
    {
      id: "action-add-contact",
      type: "action",
      title: "Add Contact",
      subtitle: "Create a new contact record",
      url: "/dashboard/contacts",
    },
    {
      id: "action-create-template",
      type: "action",
      title: "Create Template",
      subtitle: "Open AI-powered template editor",
      url: "/dashboard/templates",
    },
    {
      id: "action-create-sequence",
      type: "action",
      title: "Create Sequence",
      subtitle: "Start a new outreach sequence",
      url: "/dashboard/sequences/create",
    },
    {
      id: "page-dashboard",
      type: "page",
      title: "Dashboard",
      subtitle: "Overview and quick actions",
      url: "/dashboard",
    },
    {
      id: "page-contacts",
      type: "page",
      title: "Contacts",
      subtitle: "Manage your outreach contacts",
      url: "/dashboard/contacts",
    },
    {
      id: "page-templates",
      type: "page",
      title: "Templates",
      subtitle: "Build and manage outreach templates",
      url: "/dashboard/templates",
    },
    {
      id: "page-sequences",
      type: "page",
      title: "Sequences",
      subtitle: "Automated follow-up workflows",
      url: "/dashboard/sequences",
    },
    {
      id: "page-sent",
      type: "page",
      title: "Sent Emails",
      subtitle: "Review sent outreach history",
      url: "/dashboard/sent",
    },
    {
      id: "page-analytics",
      type: "page",
      title: "Analytics",
      subtitle: "Performance and response trends",
      url: "/dashboard/analytics",
    },
    {
      id: "page-settings",
      type: "page",
      title: "Settings",
      subtitle: "Account and product preferences",
      url: "/dashboard/settings",
    },
  ], []);

  // ── Debounce query 300ms ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Search: static filter + live API fetch ─────────────────────────────────
  useEffect(() => {
    setSelectedIndex(0);

    if (!debouncedQuery.trim()) {
      setResults(staticItems.filter((item) => item.type === "action"));
      setLoading(false);
      return;
    }

    const normalized = debouncedQuery.toLowerCase();

    // Filter static items (actions + pages)
    const staticMatches = staticItems.filter((item) =>
      `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(normalized)
    );

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    const encoded = encodeURIComponent(debouncedQuery);

    Promise.all([
      fetch(`/api/v1/contacts?search=${encoded}&limit=5`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((d: { contacts?: Array<{ id: string; full_name?: string; first_name?: string; last_name?: string; company?: string; role?: string }> }) =>
          (d.contacts ?? []).map((c): SearchResult => ({
            id: `contact-${c.id}`,
            type: "contact",
            title: c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(" ") ?? "Unknown",
            subtitle: [c.role, c.company].filter(Boolean).join(" at ") || undefined,
            url: `/dashboard/contacts/${c.id}`,
          }))
        )
        .catch(() => [] as SearchResult[]),

      fetch(`/api/v1/sequences?search=${encoded}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { sequences: [] }))
        .then((d: { sequences?: Array<{ id: string; name: string; description?: string | null; steps?: unknown[] }> }) =>
          (d.sequences ?? []).slice(0, 5).map((s): SearchResult => ({
            id: `sequence-${s.id}`,
            type: "sequence",
            title: s.name,
            subtitle: s.description ?? `${s.steps?.length ?? 0} step${(s.steps?.length ?? 0) !== 1 ? "s" : ""}`,
            url: `/dashboard/sequences/${s.id}`,
          }))
        )
        .catch(() => [] as SearchResult[]),

      fetch(`/api/v1/templates`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { templates: [] }))
        .then((d: { templates?: Array<{ id: string; name: string; subject?: string }> }) =>
          (d.templates ?? [])
            .filter((t) =>
              `${t.name} ${t.subject ?? ""}`.toLowerCase().includes(normalized)
            )
            .slice(0, 5)
            .map((t): SearchResult => ({
              id: `template-${t.id}`,
              type: "template",
              title: t.name,
              subtitle: t.subject || undefined,
              url: `/dashboard/templates`,
            }))
        )
        .catch(() => [] as SearchResult[]),
    ]).then(([contacts, sequences, templates]) => {
      if (controller.signal.aborted) return;
      setResults([...staticMatches, ...contacts, ...sequences, ...templates]);
      setLoading(false);
    });

    return () => controller.abort();
  }, [debouncedQuery, staticItems]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }

      if (!open) return;

      if (e.key === "ArrowDown") {
        if (results.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }

      if (e.key === "ArrowUp") {
        if (results.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }

      if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }

      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange, results, selectedIndex]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setLoading(false);
      abortRef.current?.abort();
    }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.url) {
      router.push(result.url);
    }
    onOpenChange(false);
    setQuery("");
  };

  const groupedResults = useMemo(() => {
    const order: Array<SearchResult["type"]> = ["action", "page", "template", "sequence", "contact"];
    return order
      .map((type) => ({
        type,
        items: results.filter((item) => item.type === type),
      }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "contact":
        return <Users className="h-4 w-4" />;
      case "sequence":
        return <Mail className="h-4 w-4" />;
      case "template":
        return <FileText className="h-4 w-4" />;
      case "action":
        return <Plus className="h-4 w-4" />;
      case "page":
        return <Home className="h-4 w-4" />;
    }
  };

  const getResultColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "contact":
        return "text-blue-500";
      case "sequence":
        return "text-purple-500";
      case "template":
        return "text-green-500";
      case "action":
        return "text-orange-500";
      case "page":
        return "text-gray-500";
    }
  };

  const getGroupLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "action":
        return "Quick Actions";
      case "page":
        return "Pages";
      case "template":
        return "Templates";
      case "sequence":
        return "Sequences";
      case "contact":
        return "Contacts";
      default:
        return "Results";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground mr-2" />
          <Input
            placeholder="Search pages, contacts, templates, or commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 gap-1">
            <Command className="h-3 w-3" />K
          </Badge>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No results found</p>
              {query && (
                <p className="text-xs mt-1">
                  Try "contacts", "templates", "sequences", or "analytics"
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {groupedResults.map((group) => (
                <div key={group.type}>
                  <div className="px-3 py-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {getGroupLabel(group.type)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {group.items.map((result) => {
                      const globalIndex = results.findIndex((item) => item.id === result.id);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <div
                            className={cn(
                              "flex-shrink-0",
                              isSelected ? "text-primary" : getResultColor(result.type)
                            )}
                          >
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {result.type}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 bg-muted/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Up</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Down</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Enter</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
