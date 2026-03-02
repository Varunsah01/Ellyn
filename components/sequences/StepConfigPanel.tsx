"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, CheckSquare, Clock3, GitBranch, Loader2, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { showToast } from "@/lib/toast";

import type { BuilderStepType, SequenceBuilderStep } from "@/components/sequences/VisualSequenceBuilder";

export interface StepConfigPanelProps {
  step: SequenceBuilderStep;
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: SequenceBuilderStep) => void;
}

type DayOption = {
  label: string;
  value: number;
};

const DAY_OPTIONS: DayOption[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
];

const CONDITION_OPTIONS = ["opened", "replied", "clicked", "bounced", "no_response"] as const;
const VARIABLE_TOKENS = ["firstName", "lastName", "company", "role"] as const;

function isBuilderStepType(value: unknown): value is BuilderStepType {
  return value === "email" || value === "wait" || value === "condition" || value === "task";
}

function resolveStepType(step: SequenceBuilderStep): BuilderStepType {
  if (isBuilderStepType(step.type)) return step.type;
  if (isBuilderStepType(step.stepType)) return step.stepType;
  return "email";
}

function normalizeSendOnDays(value: SequenceBuilderStep["send_on_days"]): number[] {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5];

  const normalized = value
    .map((item) => {
      if (typeof item === "number") return item;
      if (typeof item === "string" && item.trim()) {
        const parsed = Number(item);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })
    .filter((item): item is number => item !== null && item >= 0 && item <= 6);

  if (normalized.length === 0) {
    return [1, 2, 3, 4, 5];
  }

  return Array.from(new Set(normalized)).sort((a, b) => a - b);
}

function stepIcon(type: BuilderStepType) {
  if (type === "wait") return Clock3;
  if (type === "condition") return GitBranch;
  if (type === "task") return CheckSquare;
  return Mail;
}

function clampHour(value: number): number {
  if (Number.isNaN(value)) return 9;
  if (value < 0) return 0;
  if (value > 23) return 23;
  return value;
}

export function StepConfigPanel({ step, isOpen, onClose, onSave }: StepConfigPanelProps) {
  const [draft, setDraft] = useState<SequenceBuilderStep>(step);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(step);
  }, [step]);

  const type = useMemo(() => resolveStepType(draft), [draft]);

  const selectedDays = useMemo(() => normalizeSendOnDays(draft.send_on_days), [draft.send_on_days]);

  const canSave = useMemo(() => {
    const hasName = Boolean(draft.step_name?.trim());
    if (!hasName) return false;

    if (type === "email") {
      return Boolean(draft.subject?.trim()) && Boolean(draft.body?.trim());
    }

    if (type === "task") {
      return Boolean(draft.body?.trim());
    }

    return true;
  }, [draft.body, draft.step_name, draft.subject, type]);

  const setField = <K extends keyof SequenceBuilderStep>(field: K, value: SequenceBuilderStep[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (value: number, checked: boolean | "indeterminate") => {
    if (checked !== true && checked !== false) return;

    const nextDays = checked
      ? Array.from(new Set([...selectedDays, value])).sort((a, b) => a - b)
      : selectedDays.filter((day) => day !== value);

    setField("send_on_days", nextDays);
  };

  const insertVariable = (field: "subject" | "body", token: string) => {
    const insertion = `{{${token}}}`;

    if (field === "subject") {
      const input = subjectRef.current;
      const current = draft.subject ?? "";
      if (!input) {
        setField("subject", `${current}${insertion}`);
        return;
      }

      const start = input.selectionStart ?? current.length;
      const end = input.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${insertion}${current.slice(end)}`;
      setField("subject", next);

      requestAnimationFrame(() => {
        input.focus();
        const cursor = start + insertion.length;
        input.setSelectionRange(cursor, cursor);
      });
      return;
    }

    const textarea = bodyRef.current;
    const current = draft.body ?? "";
    if (!textarea) {
      setField("body", `${current}${insertion}`);
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${insertion}${current.slice(end)}`;
    setField("body", next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleEnhanceDraft = async () => {
    const subject = draft.subject?.trim() ?? "";
    const body = draft.body?.trim() ?? "";

    if (!subject || !body) {
      showToast.error("Add a subject and body before using AI Enhance");
      return;
    }

    setIsEnhancing(true);

    try {
      const response = await fetch("/api/ai/enhance-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          instructions: "Improve clarity, personalization, and tone while keeping the same intent.",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        subject?: string;
        body?: string;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 402) {
          showToast.error("AI draft quota exceeded");
          return;
        }
        throw new Error(payload.error ?? "Failed to enhance draft");
      }

      setDraft((prev) => ({
        ...prev,
        subject: payload.subject?.trim() || prev.subject,
        body: payload.body?.trim() || prev.body,
      }));
      showToast.success("Draft enhanced");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to enhance draft");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSave = () => {
    const normalizedDelay = Math.max(0, Number(draft.delay_days ?? 0));
    const normalizedFrom = clampHour(Number(draft.send_from_hour ?? 9));
    const normalizedTo = clampHour(Number(draft.send_to_hour ?? 17));

    const next: SequenceBuilderStep = {
      ...draft,
      type,
      stepType: type,
      step_name: draft.step_name?.trim() || `Step ${draft.order}`,
      delay_days: normalizedDelay,
      send_on_days: selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5],
      send_from_hour: normalizedFrom,
      send_to_hour: normalizedTo,
      condition_type: type === "condition" ? draft.condition_type ?? "opened" : null,
    };

    if (type === "wait") {
      next.subject = "";
      next.body = "";
    }

    if (type === "condition") {
      next.subject = "";
      next.body = "";
    }

    if (type === "task") {
      next.subject = "";
    }

    onSave(next);
  };

  const Icon = stepIcon(type);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            Configure Step
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="step-name">Step Name</Label>
            <Input
              id="step-name"
              value={draft.step_name ?? ""}
              onChange={(event) => setField("step_name", event.target.value)}
              placeholder="Step name"
            />
          </div>

          {type === "email" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="send-after">Send after X days</Label>
                <Input
                  id="send-after"
                  type="number"
                  min={0}
                  value={Number(draft.delay_days ?? 0)}
                  onChange={(event) => setField("delay_days", Number(event.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Send window</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={String(draft.send_from_hour ?? 9)}
                    onValueChange={(value) => setField("send_from_hour", Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="From hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <SelectItem key={`from-${hour}`} value={String(hour)}>
                          {hour}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={String(draft.send_to_hour ?? 17)}
                    onValueChange={(value) => setField("send_to_hour", Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="To hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <SelectItem key={`to-${hour}`} value={String(hour)}>
                          {hour}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days of week</Label>
                <div className="grid grid-cols-5 gap-2">
                  {DAY_OPTIONS.map((option) => {
                    const checked = selectedDays.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center justify-center gap-1 rounded-md border border-[#E6E4F2] p-2 text-xs"
                      >
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleDay(option.value, value)} />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subject">Subject line</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Braces className="h-4 w-4" />
                        Insert variable
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="end">
                      <div className="space-y-1">
                        {VARIABLE_TOKENS.map((token) => (
                          <Button
                            key={`subject-${token}`}
                            type="button"
                            variant="ghost"
                            className="h-8 w-full justify-start"
                            onClick={() => insertVariable("subject", token)}
                          >
                            {`{{${token}}}`}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="subject"
                  ref={subjectRef}
                  value={draft.subject ?? ""}
                  onChange={(event) => setField("subject", event.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Email body</Label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Braces className="h-4 w-4" />
                          Variables
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="end">
                        <div className="space-y-1">
                          {VARIABLE_TOKENS.map((token) => (
                            <Button
                              key={`body-${token}`}
                              type="button"
                              variant="ghost"
                              className="h-8 w-full justify-start"
                              onClick={() => insertVariable("body", token)}
                            >
                              {`{{${token}}}`}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="sm" onClick={handleEnhanceDraft} disabled={isEnhancing}>
                      {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      AI Enhance
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="body"
                  ref={bodyRef}
                  value={draft.body ?? ""}
                  onChange={(event) => setField("body", event.target.value)}
                  className="min-h-[220px]"
                  placeholder="Write your email..."
                />
              </div>
            </>
          )}

          {type === "wait" && (
            <div className="space-y-2">
              <Label htmlFor="wait-days">Wait for X days</Label>
              <Input
                id="wait-days"
                type="number"
                min={0}
                value={Number(draft.delay_days ?? 1)}
                onChange={(event) => setField("delay_days", Number(event.target.value) || 0)}
              />
            </div>
          )}

          {type === "condition" && (
            <>
              <div className="space-y-2">
                <Label>Condition type</Label>
                <Select
                  value={draft.condition_type ?? "opened"}
                  onValueChange={(value) =>
                    setField("condition_type", value as SequenceBuilderStep["condition_type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border border-[#E6E4F2] bg-[#FAFAFA] p-3 text-sm text-slate-700">
                <p>If true -&gt; continue</p>
                <p>If false -&gt; skip</p>
              </div>
            </>
          )}

          {type === "task" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="task-body">Task description</Label>
                <Textarea
                  id="task-body"
                  value={draft.body ?? ""}
                  onChange={(event) => setField("body", event.target.value)}
                  className="min-h-[140px]"
                  placeholder="Describe the manual action for this step..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-delay">Due after X days</Label>
                <Input
                  id="task-delay"
                  type="number"
                  min={0}
                  value={Number(draft.delay_days ?? 1)}
                  onChange={(event) => setField("delay_days", Number(event.target.value) || 0)}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#E6E4F2] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
