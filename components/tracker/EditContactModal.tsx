"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditableTrackerContact {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  company?: string | null;
  confirmed_email?: string | null;
  inferred_email?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
}

export interface EditContactPayload {
  firstName: string;
  lastName: string;
  role: string | null;
  company: string;
  confirmedEmail: string | null;
  linkedinUrl: string | null;
  notes: string | null;
}

interface EditContactModalProps {
  open: boolean;
  contact: EditableTrackerContact | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: EditContactPayload) => Promise<void> | void;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getDisplayName(contact: EditableTrackerContact): string {
  const fromFullName = contact.full_name?.trim();
  if (fromFullName) return fromFullName;

  return `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
}

function getDisplayEmail(contact: EditableTrackerContact): string {
  return contact.confirmed_email || contact.inferred_email || "";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditContactModal({
  open,
  contact,
  isSaving,
  onOpenChange,
  onSave,
}: EditContactModalProps) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contact) return;

    setName(getDisplayName(contact));
    setDesignation(contact.role || "");
    setCompany(contact.company || "");
    setEmail(getDisplayEmail(contact));
    setLinkedinUrl(contact.linkedin_url || "");
    setNotes(contact.notes || "");
    setError("");
  }, [contact]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedCompany = company.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    if (!trimmedCompany) {
      setError("Company is required.");
      return;
    }

    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email.");
      return;
    }

    const { firstName, lastName } = splitFullName(trimmedName);

    if (!firstName) {
      setError("Name is required.");
      return;
    }

    setError("");

    await onSave({
      firstName,
      lastName,
      role: designation.trim() || null,
      company: trimmedCompany,
      confirmedEmail: trimmedEmail || null,
      linkedinUrl: linkedinUrl.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update contact details and save changes to tracker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-contact-name">Name</Label>
            <Input
              id="edit-contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-designation">Designation</Label>
            <Input
              id="edit-contact-designation"
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
              placeholder="Job title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-company">Company</Label>
            <Input
              id="edit-contact-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-email">Email</Label>
            <Input
              id="edit-contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-linkedin">LinkedIn URL</Label>
            <Input
              id="edit-contact-linkedin"
              value={linkedinUrl}
              onChange={(event) => setLinkedinUrl(event.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-notes">Notes</Label>
            <Textarea
              id="edit-contact-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add tags, context, or follow-up details..."
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="bg-[#FF7B7B] text-white hover:bg-[#ff6b6b]"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
