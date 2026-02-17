"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

interface ConfirmDeleteModalProps {
  open: boolean;
  contactName: string;
  isDeleting: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Render the ConfirmDeleteModal component.
 * @param {ConfirmDeleteModalProps} props - Component props.
 * @returns {unknown} JSX output for ConfirmDeleteModal.
 * @example
 * <ConfirmDeleteModal />
 */
export function ConfirmDeleteModal({
  open,
  contactName,
  isDeleting,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const dialogTitle = title || "Delete Contact";
  const dialogDescription = description || (
    <>
      This will permanently remove <strong>{contactName}</strong> from your tracker.
      This action cannot be undone.
    </>
  );
  const actionLabel = confirmLabel || "Delete Contact";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isDeleting ? "Deleting..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
