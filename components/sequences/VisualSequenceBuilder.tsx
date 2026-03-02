"use client";

import { type ComponentType, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import {
  CheckSquare,
  Clock3,
  GitBranch,
  GripVertical,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { StepConfigPanel } from "@/components/sequences/StepConfigPanel";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import type { SequenceStep } from "@/lib/types/sequence";

export type BuilderStepType = "email" | "wait" | "condition" | "task";

export type SequenceBuilderStep = Omit<SequenceStep, "send_on_days"> & {
  type?: BuilderStepType | string;
  stepType?: BuilderStepType | "linkedin";
  send_on_days?: Array<number | string>;
  condition_type?: string | null;
  step_order?: number;
};

export interface VisualSequenceBuilderProps {
  sequenceName?: string;
  onSequenceNameChange?: (name: string) => void;
  steps: SequenceBuilderStep[];
  onChange: (steps: SequenceBuilderStep[]) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  templates?: Array<{ id: string; name: string; subject: string; body: string }>;
  enrolledCount?: number;
}

type StepIconConfig = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
};

const STEP_CONFIG: Record<BuilderStepType, StepIconConfig> = {
  email: {
    label: "Email",
    icon: Mail,
    iconClassName: "text-blue-600",
  },
  wait: {
    label: "Wait",
    icon: Clock3,
    iconClassName: "text-amber-600",
  },
  condition: {
    label: "Condition",
    icon: GitBranch,
    iconClassName: "text-violet-600",
  },
  task: {
    label: "Task",
    icon: CheckSquare,
    iconClassName: "text-emerald-600",
  },
};

const ADDABLE_STEP_TYPES: BuilderStepType[] = ["email", "wait", "condition", "task"];

function isBuilderStepType(value: unknown): value is BuilderStepType {
  return value === "email" || value === "wait" || value === "condition" || value === "task";
}

function resolveStepType(step: SequenceBuilderStep): BuilderStepType {
  if (isBuilderStepType(step.type)) return step.type;
  if (isBuilderStepType(step.stepType)) return step.stepType;
  return "email";
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultStep(type: BuilderStepType, index: number): SequenceBuilderStep {
  const order = index + 1;
  if (type === "wait") {
    return {
      id: generateId(),
      sequence_id: "",
      order,
      step_order: index,
      type,
      stepType: "wait",
      step_name: `Wait ${order}`,
      subject: "",
      body: "",
      delay_days: 1,
      send_on_days: [1, 2, 3, 4, 5],
      send_from_hour: 9,
      send_to_hour: 17,
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
      attachments: [],
      condition_type: null,
    };
  }

  if (type === "condition") {
    return {
      id: generateId(),
      sequence_id: "",
      order,
      step_order: index,
      type,
      stepType: "condition",
      step_name: `Condition ${order}`,
      subject: "",
      body: "",
      delay_days: 1,
      send_on_days: [1, 2, 3, 4, 5],
      send_from_hour: 9,
      send_to_hour: 17,
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
      attachments: [],
      condition_type: "opened",
    };
  }

  if (type === "task") {
    return {
      id: generateId(),
      sequence_id: "",
      order,
      step_order: index,
      type,
      stepType: "task",
      step_name: `Task ${order}`,
      subject: "",
      body: "Follow up manually with this contact.",
      delay_days: 1,
      send_on_days: [1, 2, 3, 4, 5],
      send_from_hour: 9,
      send_to_hour: 17,
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
      attachments: [],
      condition_type: null,
    };
  }

  return {
    id: generateId(),
    sequence_id: "",
    order,
    step_order: index,
    type,
    stepType: "email",
    step_name: `Email ${order}`,
    subject: "",
    body: "",
    delay_days: index === 0 ? 0 : 3,
    send_on_days: [1, 2, 3, 4, 5],
    send_from_hour: 9,
    send_to_hour: 17,
    status: "draft",
    stop_on_reply: true,
    stop_on_bounce: true,
    attachments: [],
    condition_type: null,
  };
}

function summarizeStep(step: SequenceBuilderStep, type: BuilderStepType): string {
  if (type === "wait") {
    const days = Math.max(0, Number(step.delay_days ?? 0));
    return `Wait ${days} day${days === 1 ? "" : "s"}`;
  }

  if (type === "condition") {
    return `Condition: ${step.condition_type ?? "not set"}`;
  }

  if (type === "task") {
    const description = step.body?.trim() || "Task description";
    return description.length > 80 ? `${description.slice(0, 80)}...` : description;
  }

  const subject = step.subject?.trim() || "No subject";
  return subject.length > 80 ? `${subject.slice(0, 80)}...` : subject;
}

function normalizeOrders(steps: SequenceBuilderStep[]): SequenceBuilderStep[] {
  return steps.map((step, index) => ({
    ...step,
    order: index + 1,
    step_order: index,
  }));
}

export function VisualSequenceBuilder({
  sequenceName,
  onSequenceNameChange,
  steps,
  onChange,
  onSave,
  onCancel,
  isSaving = false,
}: VisualSequenceBuilderProps) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const editingStep = useMemo(() => {
    if (!editingStepId) return null;
    return steps.find((step) => step.id === editingStepId) ?? null;
  }, [editingStepId, steps]);

  const handleReorder = (reordered: SequenceBuilderStep[]) => {
    onChange(normalizeOrders(reordered));
  };

  const handleAddStep = (type: BuilderStepType) => {
    const next = [...steps, createDefaultStep(type, steps.length)];
    onChange(normalizeOrders(next));
  };

  const handleDeleteStep = (stepId: string) => {
    onChange(normalizeOrders(steps.filter((step) => step.id !== stepId)));
    if (editingStepId === stepId) {
      setEditingStepId(null);
    }
  };

  const handleSaveStep = (updatedStep: SequenceBuilderStep) => {
    const next = steps.map((step) => (step.id === updatedStep.id ? updatedStep : step));
    onChange(normalizeOrders(next));
    setEditingStepId(null);
  };

  return (
    <div className="space-y-4">
      {(onSave || onCancel || onSequenceNameChange) && (
        <div className="rounded-xl border border-[#E6E4F2] bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              {onSequenceNameChange ? (
                <Input
                  value={sequenceName ?? ""}
                  onChange={(event) => onSequenceNameChange(event.target.value)}
                  placeholder="Sequence name"
                  className="h-10"
                />
              ) : (
                <p className="text-lg font-semibold text-[#2D2B55]">{sequenceName || "Sequence"}</p>
              )}
            </div>
            {(onSave || onCancel) && (
              <div className="flex items-center gap-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                    Cancel
                  </Button>
                )}
                {onSave && (
                  <Button type="button" onClick={onSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E6E4F2] bg-white p-4">
        <Reorder.Group axis="y" values={steps} onReorder={handleReorder} className="space-y-3">
          {steps.map((step, index) => {
            const stepType = resolveStepType(step);
            const config = STEP_CONFIG[stepType];
            const Icon = config.icon;

            return (
              <Reorder.Item key={step.id} value={step} className="list-none">
                <div className="flex items-start gap-3 rounded-lg border border-[#E6E4F2] bg-[#FAFAFA] p-3">
                  <GripVertical className="mt-1 h-4 w-4 cursor-grab text-slate-400" />
                  <div className="mt-0.5 rounded-md bg-white p-1.5">
                    <Icon className={`h-4 w-4 ${config.iconClassName}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                    <p className="truncate text-sm font-semibold text-[#2D2B55]">
                      {step.step_name?.trim() || `${config.label} ${index + 1}`}
                    </p>
                    <p className="truncate text-xs text-slate-600">{summarizeStep(step, stepType)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingStepId(step.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteStep(step.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <div className="mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full">
                <Plus className="h-4 w-4" />
                Add Step
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {ADDABLE_STEP_TYPES.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => handleAddStep(type)}>
                  {STEP_CONFIG[type].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {editingStep && (
        <StepConfigPanel
          step={editingStep}
          isOpen
          onClose={() => setEditingStepId(null)}
          onSave={handleSaveStep}
        />
      )}
    </div>
  );
}
