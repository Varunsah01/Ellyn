"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileText } from "lucide-react";
import { showToast } from "@/lib/toast";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";

const MAX_CHARS = 500;
const TRUNCATE_AT = 80;

interface InlineNotesCellProps {
  contactId: string;
  initialNotes: string;
  onUpdate: (contactId: string, notes: string) => void;
}

export function InlineNotesCell({
  contactId,
  initialNotes,
  onUpdate,
}: InlineNotesCellProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNotes);
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [editing, draft]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(notes);
    setEditing(true);
  };

  const save = async () => {
    const trimmed = draft.trim();
    const previous = notes;
    setNotes(trimmed);
    setEditing(false);
    onUpdate(contactId, trimmed);

    try {
      const res = await supabaseAuthedFetch(`/api/v1/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setNotes(previous);
      onUpdate(contactId, previous);
      showToast.error("Failed to save notes");
    }
  };

  const handleBlur = () => {
    void save();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      void save();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(notes);
    }
  };

  if (editing) {
    return (
      <div
        className="relative min-w-[200px]"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={3}
          className="w-full resize-none rounded border border-primary/50 bg-background px-2 py-1.5 text-xs text-foreground outline-none ring-1 ring-primary/30 focus:ring-2 focus:ring-primary"
          placeholder="Add a note…"
        />
        <span className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground">
          {draft.length}/{MAX_CHARS}
        </span>
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-text min-w-[160px]"
      onClick={startEdit}
    >
      {notes ? (
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {showAll || notes.length <= TRUNCATE_AT
                ? notes
                : `${notes.slice(0, TRUNCATE_AT)}…`}
            </p>
            {notes.length > TRUNCATE_AT && !showAll && (
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAll(true);
                }}
              >
                Show more
              </button>
            )}
          </div>
          <AnimatePresence>
            {saved && (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex-shrink-0 text-green-600"
              >
                <Check className="h-3 w-3" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          <FileText className="h-3 w-3" />
          Add note
        </span>
      )}
    </div>
  );
}
