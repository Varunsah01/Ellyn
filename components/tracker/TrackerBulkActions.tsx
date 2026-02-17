"use client";

import { Download, Eraser, FilePenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { TrackerContactStatus } from "@/lib/types/tracker";

interface TrackerBulkActionsProps {
  selectedCount: number;
  totalVisibleCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkStatusUpdate: (status: TrackerContactStatus) => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkAddNote: () => void;
}

/**
 * Render the TrackerBulkActions component.
 * @param {TrackerBulkActionsProps} props - Component props.
 * @returns {unknown} JSX output for TrackerBulkActions.
 * @example
 * <TrackerBulkActions />
 */
export function TrackerBulkActions({
  selectedCount,
  totalVisibleCount,
  onSelectAll,
  onSelectNone,
  onBulkStatusUpdate,
  onBulkDelete,
  onBulkExport,
  onBulkAddNote,
}: TrackerBulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span>No contacts selected</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
            Select all ({totalVisibleCount})
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FF7B7B]/40 bg-[#fff5f5] px-3 py-2">
      <div className="text-sm text-slate-700">
        <span className="font-semibold">{selectedCount}</span> selected
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
          Select all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onSelectNone}>
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Select none
        </Button>

        <Select onValueChange={(value) => onBulkStatusUpdate(value as TrackerContactStatus)}>
          <SelectTrigger className="h-8 w-[150px] bg-white">
            <SelectValue placeholder="Bulk status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Draft</SelectItem>
            <SelectItem value="contacted">Sent</SelectItem>
            <SelectItem value="no_response">Opened / No response</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" size="sm" onClick={onBulkAddNote}>
          <FilePenLine className="mr-1.5 h-3.5 w-3.5" />
          Add note
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onBulkExport}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onBulkDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
