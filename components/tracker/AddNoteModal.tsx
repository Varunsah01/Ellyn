"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddNoteModalProps {
  open: boolean;
  contactName: string;
  initialNote?: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (note: string) => Promise<void> | void;
}

export function AddNoteModal({
  open,
  contactName,
  initialNote,
  isSaving,
  onCancel,
  onSave,
}: AddNoteModalProps) {
  const [note, setNote] = useState(initialNote || "");

  useEffect(() => {
    setNote(initialNote || "");
  }, [initialNote, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Save a note for <strong>{contactName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Type your note..."
          rows={6}
        />

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSave(note)}
            disabled={isSaving}
            className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b]"
          >
            {isSaving ? "Saving..." : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
