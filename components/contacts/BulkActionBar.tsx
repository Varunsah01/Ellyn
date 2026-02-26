"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Download, ChevronDown, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { showToast } from "@/lib/toast";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import type { Contact } from "@/lib/types/contact";

const API_STATUS_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Replied", value: "replied" },
  { label: "No Response", value: "no_response" },
];

interface BulkActionBarProps {
  selected: Contact[];
  allUserTags: string[];
  onDeselect: () => void;
  onBulkUpdate: (ids: string[], patch: Record<string, unknown>) => void;
  onBulkDelete: (ids: string[]) => void;
}

function exportCsv(contacts: Contact[]) {
  const header = ["Name", "Company", "Email", "Status", "Tags"];
  const rows = contacts.map((c) => [
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.company.replace(/"/g, '""')}"`,
    `"${c.email.replace(/"/g, '""')}"`,
    c.status,
    `"${(c.tags ?? []).join(", ")}"`,
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkActionBar({
  selected,
  allUserTags,
  onDeselect,
  onBulkUpdate,
  onBulkDelete,
}: BulkActionBarProps) {
  const [tagInput, setTagInput] = useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const ids = selected.map((c) => c.id);

  const handleBulkTag = async (tag: string) => {
    const trimmed = tag.trim().slice(0, 20);
    if (!trimmed) return;
    setTagPopoverOpen(false);
    setTagInput("");

    const patch = (c: Contact) => [...new Set([...(c.tags ?? []), trimmed])];
    // Optimistic: apply tag to each selected contact
    const patchMap: Record<string, string[]> = {};
    selected.forEach((c) => {
      patchMap[c.id] = patch(c);
    });
    onBulkUpdate(ids, { _tagPatch: patchMap });

    try {
      await Promise.all(
        selected.map((c) =>
          supabaseAuthedFetch(`/api/v1/contacts/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: patchMap[c.id] }),
          })
        )
      );
      showToast.success(`Tag "${trimmed}" added to ${selected.length} contact(s)`);
    } catch {
      showToast.error("Failed to add tags");
    }
  };

  const handleBulkStatus = async (status: string) => {
    onBulkUpdate(ids, { status });
    try {
      await Promise.all(
        ids.map((id) =>
          supabaseAuthedFetch(`/api/v1/contacts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      showToast.success(`Status updated for ${selected.length} contact(s)`);
    } catch {
      showToast.error("Failed to update status");
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(
        ids.map((id) =>
          supabaseAuthedFetch(`/api/v1/contacts/${id}`, { method: "DELETE" })
        )
      );
      onBulkDelete(ids);
      showToast.success(`Deleted ${selected.length} contact(s)`);
      setDeleteOpen(false);
    } catch {
      showToast.error("Failed to delete some contacts");
    } finally {
      setIsDeleting(false);
    }
  };

  const suggestedTags = allUserTags.filter(
    (t) => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            key="bulk-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 shadow-xl">
              {/* Deselect */}
              <button
                type="button"
                onClick={onDeselect}
                className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Deselect all"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <span className="text-sm font-medium text-foreground">
                {selected.length} selected
              </span>

              <div className="mx-2 h-4 w-px bg-border" />

              {/* Tag */}
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    Tag
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2 space-y-2" align="center" side="top">
                  <Input
                    placeholder="Add tag…"
                    value={tagInput}
                    maxLength={20}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleBulkTag(tagInput);
                    }}
                    className="h-7 text-xs"
                    autoFocus
                  />
                  {suggestedTags.length > 0 && (
                    <div className="space-y-0.5">
                      {suggestedTags.slice(0, 6).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => void handleBulkTag(tag)}
                          className="flex w-full rounded px-1.5 py-1 text-xs hover:bg-muted transition-colors text-left"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  {tagInput.trim() && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-xs"
                      onClick={() => void handleBulkTag(tagInput)}
                    >
                      Apply &ldquo;{tagInput.trim().slice(0, 15)}&rdquo;
                    </Button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Export */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => exportCsv(selected)}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>

              {/* Change Status */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5">
                    Status
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  {API_STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => void handleBulkStatus(opt.value)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Delete */}
              <Button
                size="sm"
                variant="destructive"
                className="h-8 gap-1.5"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.length} contact(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <strong className="text-foreground">{selected.length}</strong>{" "}
            contact(s). This action cannot be undone.
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
              onClick={() => void handleBulkDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : `Delete ${selected.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
