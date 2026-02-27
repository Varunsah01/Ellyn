"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";

import { useToast } from "@/hooks/useToast";
import { makeTodoItem, sanitizeTodoItems, toggleTodoItem, type TodoItem } from "@/lib/todos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function parseApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function TodoListPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newText, setNewText] = useState("");

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/todos", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseApiError(payload, "Failed to load to-do list"));
      }

      const nextItems = sanitizeTodoItems((payload as { items?: unknown }).items);
      setItems(nextItems);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to load to-do list";
      toast({
        title: "To-Do unavailable",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const persistTodos = useCallback(
    async (nextItems: TodoItem[]) => {
      setSaving(true);
      try {
        const response = await fetch("/api/todos", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items: nextItems }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseApiError(payload, "Failed to save to-do list"));
        }

        setItems(sanitizeTodoItems((payload as { items?: unknown }).items));
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleAdd = async () => {
    const normalized = newText.trim();
    if (!normalized) return;

    const nextItems = sanitizeTodoItems([makeTodoItem(normalized), ...items]);
    setItems(nextItems);
    setNewText("");
    setComposerOpen(false);

    try {
      await persistTodos(nextItems);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to save to-do list";
      toast({
        title: "Unable to add item",
        description,
        variant: "destructive",
      });
      await loadTodos();
    }
  };

  const handleToggle = async (id: string) => {
    const nextItems = toggleTodoItem(items, id);
    setItems(nextItems);

    try {
      await persistTodos(nextItems);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Failed to update to-do item";
      toast({
        title: "Unable to update item",
        description,
        variant: "destructive",
      });
      await loadTodos();
    }
  };

  const displayItems = useMemo(() => sanitizeTodoItems(items), [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">To-Do</CardTitle>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setComposerOpen((current) => !current)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add More
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {composerOpen ? (
          <div className="flex items-center gap-2">
            <Input
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAdd();
                }
                if (event.key === "Escape") {
                  setComposerOpen(false);
                }
              }}
              placeholder="Add a to-do item"
              maxLength={180}
              autoFocus
            />
            <Button type="button" size="sm" onClick={() => void handleAdd()}>
              Save
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading to-do list...
          </div>
        ) : displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add your first to-do to keep extension and dashboard tasks synced.
          </p>
        ) : (
          <ul className="space-y-2">
            {displayItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left"
                  onClick={() => void handleToggle(item.id)}
                  disabled={saving}
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      item.completed
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span
                    className={`text-sm ${
                      item.completed ? "text-muted-foreground line-through" : "text-slate-900"
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

