"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  Mail,
  FileText,
  Settings,
  Plus,
  BarChart3,
  Command,
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

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Mock search data (replace with actual API calls)
  const mockData: SearchResult[] = [
    // Quick Actions
    {
      id: "action-add-contact",
      type: "action",
      title: "Add Contact",
      subtitle: "Create a new contact",
      action: () => router.push("/dashboard/contacts"),
    },
    {
      id: "action-create-sequence",
      type: "action",
      title: "Create Sequence",
      subtitle: "Start a new email sequence",
      action: () => router.push("/dashboard/sequences/create"),
    },
    {
      id: "action-view-analytics",
      type: "action",
      title: "View Analytics",
      subtitle: "See your performance metrics",
      action: () => router.push("/dashboard/analytics"),
    },

    // Pages
    {
      id: "page-contacts",
      type: "page",
      title: "Contacts",
      subtitle: "Manage your contacts",
      url: "/dashboard/contacts",
    },
    {
      id: "page-sequences",
      type: "page",
      title: "Sequences",
      subtitle: "Manage email sequences",
      url: "/dashboard/sequences",
    },
    {
      id: "page-analytics",
      type: "page",
      title: "Analytics",
      subtitle: "View performance reports",
      url: "/dashboard/analytics",
    },
    {
      id: "page-settings",
      type: "page",
      title: "Settings",
      subtitle: "Configure your preferences",
      url: "/dashboard/settings",
    },

    // Sample contacts
    {
      id: "contact-1",
      type: "contact",
      title: "John Smith",
      subtitle: "Software Engineer at Google",
      url: "/dashboard/contacts",
    },
    {
      id: "contact-2",
      type: "contact",
      title: "Sarah Johnson",
      subtitle: "Product Manager at Meta",
      url: "/dashboard/contacts",
    },

    // Sample sequences
    {
      id: "sequence-1",
      type: "sequence",
      title: "Software Engineer Outreach Q1 2024",
      subtitle: "45 contacts enrolled",
      url: "/dashboard/sequences/1",
    },
    {
      id: "sequence-2",
      type: "sequence",
      title: "Product Manager Referral Requests",
      subtitle: "12 contacts enrolled",
      url: "/dashboard/sequences/2",
    },
  ];

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Show quick actions when no query
      setResults(mockData.filter((item) => item.type === "action"));
      return;
    }

    const filtered = mockData.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(filtered);
  }, []);

  useEffect(() => {
    performSearch(query);
    setSelectedIndex(0);
  }, [query, performSearch]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }

      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }

      if (e.key === "ArrowUp") {
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

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.url) {
      router.push(result.url);
    }
    onOpenChange(false);
    setQuery("");
  };

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
        return <BarChart3 className="h-4 w-4" />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground mr-2" />
          <Input
            placeholder="Search contacts, sequences, or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 gap-1">
            <Command className="h-3 w-3" />K
          </Badge>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No results found</p>
              {query && (
                <p className="text-xs mt-1">
                  Try searching for contacts, sequences, or pages
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {!query && (
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Quick Actions
                  </p>
                </div>
              )}

              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left",
                    index === selectedIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0",
                      index === selectedIndex
                        ? "text-primary"
                        : getResultColor(result.type)
                    )}
                  >
                    {getResultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {result.type}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 bg-muted/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">ESC</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
