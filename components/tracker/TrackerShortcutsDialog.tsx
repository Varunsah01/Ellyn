"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TrackerShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { keys: "Ctrl/Cmd + K", description: "Focus search" },
  { keys: "Ctrl/Cmd + F", description: "Open filters" },
  { keys: "Ctrl/Cmd + N", description: "Add new contact" },
  { keys: "Arrow keys", description: "Move row/card focus" },
  { keys: "Enter", description: "Open focused contact" },
  { keys: "Esc", description: "Close open popovers/modals" },
];

export function TrackerShortcutsDialog({ open, onOpenChange }: TrackerShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="text-slate-600 dark:text-slate-300">{shortcut.description}</span>
              <kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
