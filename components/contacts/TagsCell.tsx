"use client";

import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { showToast } from "@/lib/toast";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";

const TAG_COLORS = [
  "#E0E7FF",
  "#FCE7F3",
  "#D1FAE5",
  "#FEF3C7",
  "#E0F2FE",
  "#F3E8FF",
] as const;

const TAG_TEXT_COLORS = [
  "#3730A3",
  "#9D174D",
  "#065F46",
  "#92400E",
  "#0369A1",
  "#6B21A8",
] as const;

function getTagColorIndex(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash * 31) + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TAG_COLORS.length;
}

interface TagsCellProps {
  contactId: string;
  initialTags: string[];
  allUserTags: string[];
  onUpdate: (contactId: string, tags: string[]) => void;
}

export function TagsCell({
  contactId,
  initialTags,
  allUserTags,
  onUpdate,
}: TagsCellProps) {
  const [tags, setTags] = useState(initialTags);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const saveTags = async (newTags: string[]) => {
    const previous = tags;
    setTags(newTags);
    onUpdate(contactId, newTags);
    try {
      const res = await supabaseAuthedFetch(`/api/v1/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!res.ok) throw new Error("Failed to save tags");
    } catch {
      setTags(previous);
      onUpdate(contactId, previous);
      showToast.error("Failed to update tags");
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().slice(0, 20);
    if (!trimmed || tags.includes(trimmed)) return;
    void saveTags([...tags, trimmed]);
    setInputValue("");
  };

  const removeTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void saveTags(tags.filter((t) => t !== tag));
  };

  const suggestions = allUserTags.filter(
    (t) =>
      !tags.includes(t) &&
      t.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {tags.map((tag) => {
        const idx = getTagColorIndex(tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: TAG_COLORS[idx],
              color: TAG_TEXT_COLORS[idx],
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => removeTag(tag, e)}
              className="ml-0.5 hover:opacity-70 transition-opacity"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors"
            aria-label="Add tag"
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-52 p-2 space-y-2"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            ref={inputRef}
            placeholder="Add tag…"
            value={inputValue}
            maxLength={20}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (inputValue.trim()) {
                  addTag(inputValue);
                  setOpen(false);
                }
              }
            }}
            className="h-7 text-xs"
            autoFocus
          />

          {suggestions.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Existing tags
              </p>
              {suggestions.slice(0, 8).map((tag) => {
                const idx = getTagColorIndex(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      addTag(tag);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: TAG_COLORS[idx] }}
                    />
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {inputValue.trim() && !tags.includes(inputValue.trim()) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => {
                addTag(inputValue);
                setOpen(false);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Create &ldquo;{inputValue.trim().slice(0, 15)}&rdquo;
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
