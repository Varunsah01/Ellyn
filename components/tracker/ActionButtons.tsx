"use client";

import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  ExternalLink,
  MessageCircleReply,
  MessageSquarePlus,
  MoreVertical,
  Pencil,
  Trash2,
  UserRoundX,
} from "lucide-react";

interface ActionButtonsProps {
  onFollowUp: () => void;
  onEdit: () => void;
  onMarkReplied: () => void;
  onMarkNotInterested: () => void;
  onAddNote: () => void;
  onViewLinkedIn: () => void;
  onDelete: () => void;
}

/**
 * Render the FollowUpButton component.
 * @param {Pick<ActionButtonsProps, "onFollowUp">} props - Component props.
 * @returns {unknown} JSX output for FollowUpButton.
 * @example
 * <FollowUpButton />
 */
export function FollowUpButton({ onFollowUp }: Pick<ActionButtonsProps, "onFollowUp">) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onFollowUp}
      className="h-7 w-[72px] rounded-md bg-[#FF7B7B] px-0 text-xs text-white hover:bg-[#ff6b6b] focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/50"
      aria-label="Open follow up draft"
    >
      Follow up
    </Button>
  );
}

/**
 * Render the EditContactButton component.
 * @param {Pick<ActionButtonsProps, "onEdit">} props - Component props.
 * @returns {unknown} JSX output for EditContactButton.
 * @example
 * <EditContactButton />
 */
export function EditContactButton({ onEdit }: Pick<ActionButtonsProps, "onEdit">) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-[#9CA3AF] hover:text-[#FF7B7B]"
      onClick={onEdit}
      aria-label="Edit contact"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * Render the MoreActionsButton component.
 * @param {Pick<
  ActionButtonsProps,
  "onViewLinkedIn" | "onMarkReplied" | "onMarkNotInterested" | "onAddNote" | "onDelete"
>} props - Component props.
 * @returns {unknown} JSX output for MoreActionsButton.
 * @example
 * <MoreActionsButton />
 */
export function MoreActionsButton({
  onViewLinkedIn,
  onMarkReplied,
  onMarkNotInterested,
  onAddNote,
  onDelete,
}: Pick<
  ActionButtonsProps,
  "onViewLinkedIn" | "onMarkReplied" | "onMarkNotInterested" | "onAddNote" | "onDelete"
>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-[#9CA3AF] hover:text-[#FF7B7B]"
          aria-label="More options"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 w-52 rounded-lg border bg-white shadow-lg">
        <DropdownMenuItem onClick={onViewLinkedIn}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View LinkedIn Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMarkReplied}>
          <MessageCircleReply className="mr-2 h-4 w-4" />
          Mark as Replied
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMarkNotInterested}>
          <UserRoundX className="mr-2 h-4 w-4" />
          Mark as Not Interested
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddNote}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Add Note
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Render the ActionButtons component.
 * @param {ActionButtonsProps} props - Component props.
 * @returns {unknown} JSX output for ActionButtons.
 * @example
 * <ActionButtons />
 */
export function ActionButtons(props: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <FollowUpButton onFollowUp={props.onFollowUp} />
      <EditContactButton onEdit={props.onEdit} />
      <MoreActionsButton
        onViewLinkedIn={props.onViewLinkedIn}
        onMarkReplied={props.onMarkReplied}
        onMarkNotInterested={props.onMarkNotInterested}
        onAddNote={props.onAddNote}
        onDelete={props.onDelete}
      />
    </div>
  );
}
