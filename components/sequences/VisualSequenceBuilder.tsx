"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Clock,
  ClipboardList,
  MessageSquare,
  Zap,
  Copy,
  X,
} from "lucide-react";
import { SequenceStep, StepType, ConditionType } from "@/lib/types/sequence";
import { generateStepId } from "@/lib/utils/sequence-utils";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { StepConfigPanel } from "@/components/sequences/StepConfigPanel";
import { usePersona } from "@/context/PersonaContext";

// ─── Config ───────────────────────────────────────────────────────────────────

interface StepTypeConfig {
  label: string;
  Icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
}

const STEP_TYPE_CONFIG: Record<StepType, StepTypeConfig> = {
  email: {
    label: "Email",
    Icon: Mail,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  wait: {
    label: "Wait",
    Icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  task: {
    label: "Task",
    Icon: ClipboardList,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  linkedin: {
    label: "LinkedIn",
    Icon: MessageSquare,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
};

const STEP_TYPE_PALETTE: StepType[] = ["email", "wait", "task", "linkedin"];

const CONDITION_CYCLE: ConditionType[] = ["always", "no_reply", "opened", "clicked"];

function getConditionLabel(type: ConditionType, days: number): string {
  switch (type) {
    case "always":
      return days === 0 ? "Immediately" : `Continue after ${days} day${days !== 1 ? "s" : ""}`;
    case "no_reply":
      return "Only if no reply";
    case "opened":
      return "Only if email opened";
    case "clicked":
      return "Only if link clicked";
  }
}

function getStepLabel(step: SequenceStep, index: number): string {
  const type = step.stepType ?? "email";
  if (type === "wait") {
    return `Wait · ${step.delay_days} day${step.delay_days !== 1 ? "s" : ""}`;
  }
  const dayPrefix = index === 0 ? "Day 0" : `Day +${step.delay_days}`;
  const name = step.step_name || step.subject || step.body || "(no content)";
  const preview = name.length > 42 ? name.slice(0, 42) + "…" : name;
  return `${dayPrefix} · ${STEP_TYPE_CONFIG[type].label} · ${preview}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VisualSequenceBuilderProps {
  steps: SequenceStep[];
  onChange: (steps: SequenceStep[]) => void;
  templates?: Array<{ id: string; name: string; subject: string; body: string }>;
  enrolledCount?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VisualSequenceBuilder({
  steps,
  onChange,
  templates = [],
  enrolledCount = 0,
}: VisualSequenceBuilderProps) {
  const { isSalesRep } = usePersona();
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [editingIndex, setEditingIndex] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const availableStepTypes = useMemo(
    () =>
      isSalesRep
        ? STEP_TYPE_PALETTE
        : STEP_TYPE_PALETTE.filter((type) => type !== "linkedin"),
    [isSalesRep]
  );

  const totalDays = steps.reduce((acc, s) => acc + s.delay_days, 0);

  const openAddStep = (type: StepType) => {
    if (!isSalesRep && type === "linkedin") {
      return;
    }

    const order = steps.length + 1;
    const newStep: SequenceStep = {
      id: generateStepId(),
      sequence_id: "",
      order,
      delay_days: steps.length === 0 ? 0 : 3,
      subject: "",
      body: "",
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
      stepType: type,
      conditionType: "always",
      step_name: `${capitalize(type)} ${order}`,
      send_on_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      send_from_hour: 9,
      send_to_hour: 18,
    };
    setEditingStep(newStep);
    setEditingIndex(steps.length);
    setIsPanelOpen(true);
    setShowPalette(false);
  };

  const openEditStep = (step: SequenceStep, index: number) => {
    setEditingStep(step);
    setEditingIndex(index);
    setIsPanelOpen(true);
  };

  const saveStep = (step: SequenceStep) => {
    const exists = steps.find((s) => s.id === step.id);
    if (exists) {
      onChange(steps.map((s) => (s.id === step.id ? step : s)));
    } else {
      onChange([...steps, step]);
    }
    setIsPanelOpen(false);
    setEditingStep(null);
  };

  const duplicateStep = (step: SequenceStep) => {
    const dup: SequenceStep = {
      ...step,
      id: generateStepId(),
      order: steps.length + 1,
      step_name: step.step_name ? `${step.step_name} (copy)` : undefined,
    };
    onChange([...steps, dup]);
  };

  const deleteStep = (stepId: string) => {
    onChange(
      steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i + 1 }))
    );
  };

  const handleReorder = (newSteps: SequenceStep[]) => {
    onChange(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const cycleCondition = (stepId: string, current: ConditionType) => {
    const idx = CONDITION_CYCLE.indexOf(current);
    const next = CONDITION_CYCLE[(idx + 1) % CONDITION_CYCLE.length];
    onChange(steps.map((s) => (s.id === stepId ? { ...s, conditionType: next } : s)));
  };

  return (
    <div>
      {/* Summary bar */}
      {steps.length > 0 && (
        <div className="flex items-center gap-3 mb-5 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5 border">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">
            {steps.length} step{steps.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>Est. {totalDays} day{totalDays !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{enrolledCount} contact{enrolledCount !== 1 ? "s" : ""} enrolled</span>
        </div>
      )}

      {/* Pipeline canvas */}
      <div>
        {/* Trigger node */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Trigger
            </p>
            <p className="text-sm font-semibold">Contact Enrolled</p>
          </div>
        </div>

        {/* Connector from trigger */}
        {steps.length > 0 && (
          <div className="ml-6 border-l-2 border-dashed border-muted h-6" />
        )}

        {/* Step nodes */}
        {steps.length > 0 && (
          <Reorder.Group
            axis="y"
            values={steps}
            onReorder={handleReorder}
            className="space-y-0"
          >
            {steps.map((step, index) => (
              <Reorder.Item key={step.id} value={step} className="list-none">
                {/* Condition connector (only for subsequent steps) */}
                {index > 0 && (
                  <div className="ml-6">
                    <div className="border-l-2 border-dashed border-muted h-3" />
                    <button
                      type="button"
                      onClick={() =>
                        cycleCondition(step.id, step.conditionType ?? "always")
                      }
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/80 border border-border/50 hover:bg-muted transition-colors text-muted-foreground"
                      title="Click to cycle condition"
                    >
                      <span className="text-green-600">✓</span>
                      <span>
                        {getConditionLabel(
                          step.conditionType ?? "always",
                          step.delay_days
                        )}
                      </span>
                    </button>
                    <div className="border-l-2 border-dashed border-muted h-3" />
                  </div>
                )}

                {/* Step node card */}
                <StepNode
                  step={step}
                  index={index}
                  onEdit={() => openEditStep(step, index)}
                  onDuplicate={() => duplicateStep(step)}
                  onDelete={() => deleteStep(step.id)}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Bottom connector */}
        <div className="ml-6 border-l-2 border-dashed border-muted h-6" />

        {/* Add step area */}
        <AnimatePresence mode="wait">
          {showPalette ? (
            <motion.div
              key="palette"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
            >
              <StepTypePalette
                stepTypes={availableStepTypes}
                onSelect={openAddStep}
                onClose={() => setShowPalette(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="add-btn"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
              className="flex justify-center"
            >
              <button
                type="button"
                onClick={() => setShowPalette(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-full border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors animate-pulse hover:animate-none"
              >
                <Plus className="h-4 w-4" />
                {steps.length === 0 ? "Add First Step" : "Add Step"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step config panel (sheet) */}
      {isPanelOpen && editingStep && (
        <StepConfigPanel
          step={editingStep}
          stepIndex={editingIndex}
          totalSteps={Math.max(steps.length, editingIndex + 1)}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setEditingStep(null);
          }}
          onSave={saveStep}
          templates={templates}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StepNodeProps {
  step: SequenceStep;
  index: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function StepNode({ step, index, onEdit, onDuplicate, onDelete }: StepNodeProps) {
  const type = step.stepType ?? "email";
  const config = STEP_TYPE_CONFIG[type];
  const { Icon } = config;

  return (
    <div className="bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 px-3 py-3 group cursor-pointer">
      {/* Drag handle */}
      <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab active:cursor-grabbing shrink-0" />

      {/* Type icon */}
      <button
        type="button"
        onClick={onEdit}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${config.bg} ${config.border}`}
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
      </button>

      {/* Step info */}
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-medium truncate">{getStepLabel(step, index)}</p>
        <p className="text-xs text-muted-foreground">{config.label} step</p>
      </button>

      {/* Status badge */}
      <span
        className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
          step.status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {step.status === "active" ? "Active" : "Draft"}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 w-7 p-0"
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          className="h-7 w-7 p-0"
          type="button"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 w-7 p-0 hover:text-destructive"
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface StepTypePaletteProps {
  stepTypes: StepType[];
  onSelect: (type: StepType) => void;
  onClose: () => void;
}

function StepTypePalette({ stepTypes, onSelect, onClose }: StepTypePaletteProps) {
  return (
    <div className="border rounded-xl bg-card shadow-md p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Choose step type
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stepTypes.map((type) => {
          const { label, Icon, color, bg, border } = STEP_TYPE_CONFIG[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border ${border} ${bg} hover:opacity-80 transition-opacity`}
            >
              <Icon className={`h-4 w-4 ${color}`} />
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
