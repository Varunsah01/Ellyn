"use client";

import { useEffect, useRef, useState } from "react";
import { MailOpen, PencilLine, Reply, Send } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export type PipelineStage = "draft" | "sent" | "opened" | "replied";

interface StatusStage {
  key: PipelineStage;
  label: string;
}

const PIPELINE_STAGES: StatusStage[] = [
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "opened", label: "Opened" },
  { key: "replied", label: "Replied" },
];

const PIPELINE_STAGE_COLOR: Record<PipelineStage, string> = {
  draft: "#9CA3AF",
  sent: "#3B82F6",
  opened: "#F59E0B",
  replied: "#EF4444",
};

const PIPELINE_STAGE_ICON = {
  draft: PencilLine,
  sent: Send,
  opened: MailOpen,
  replied: Reply,
};

interface StatusPipelineProps {
  currentStatus: PipelineStage;
  contactId: string;
  compact?: boolean;
  onStatusChange?: (newStatus: PipelineStage) => Promise<void> | void;
}

type StatusLogEntry = {
  from: PipelineStage;
  to: PipelineStage;
  changedAt: string;
};

function getStatusIndex(status: PipelineStage): number {
  return PIPELINE_STAGES.findIndex((stage) => stage.key === status);
}

function getStatusLabel(status: PipelineStage): string {
  return PIPELINE_STAGES.find((stage) => stage.key === status)?.label || status;
}

function getStatusLogStorageKey(contactId: string): string {
  return `ellyn:tracker-status-log:${contactId}`;
}

function persistStatusLog(contactId: string, entry: StatusLogEntry) {
  if (typeof window === "undefined") return;

  try {
    const key = getStatusLogStorageKey(contactId);
    const existing = window.localStorage.getItem(key);
    const parsed = existing ? (JSON.parse(existing) as StatusLogEntry[]) : [];
    const updated = [...parsed, entry].slice(-100);
    window.localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Logging should never interrupt UX.
  }
}

function connectorLineClasses(isActive: boolean, compact: boolean): string {
  return cn("h-px", compact ? "w-3" : "w-4", isActive ? "bg-current" : "bg-[#D1D5DB]");
}

function connectorArrowClasses(isActive: boolean, compact: boolean): string {
  return cn(
    "h-0 w-0 border-y-[3px] border-y-transparent",
    compact ? "border-l-[4px]" : "border-l-[5px]",
    isActive ? "border-l-current" : "border-l-[#D1D5DB]"
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "").trim();
  const normalized = value.length === 3
    ? value.split("").map((char) => `${char}${char}`).join("")
    : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return [red, green, blue];
}

function buildGlow(color: string): string | undefined {
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  return `0 0 0 3px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.2), 0 0 14px rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`;
}

export function StatusPipeline({
  currentStatus,
  contactId,
  compact = false,
  onStatusChange,
}: StatusPipelineProps) {
  const [status, setStatus] = useState<PipelineStage>(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const currentIndex = getStatusIndex(status);
  const isDraftState = status === "draft";

  const updateStatus = async (nextStatus: PipelineStage) => {
    if (isUpdating || nextStatus === status) return;

    const nextIndex = getStatusIndex(nextStatus);

    if (nextIndex > currentIndex + 1) {
      toast.error("Please move status one step at a time.");
      return;
    }

    if (nextIndex < currentIndex) {
      const confirmed = window.confirm(
        `Move status backward from ${getStatusLabel(status)} to ${getStatusLabel(nextStatus)}?`
      );
      if (!confirmed) return;
    }

    const previousStatus = status;
    setStatus(nextStatus);
    setIsUpdating(true);

    try {
      await onStatusChange?.(nextStatus);
      const changedAt = new Date().toISOString();
      persistStatusLog(contactId, {
        from: previousStatus,
        to: nextStatus,
        changedAt,
      });

      const spoken = `Status changed from ${getStatusLabel(previousStatus)} to ${getStatusLabel(nextStatus)}.`;
      setAnnouncement(spoken);
      toast.success(spoken);
    } catch {
      setStatus(previousStatus);
      toast.error("Could not update status. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    stage: PipelineStage
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      buttonRefs.current[index + 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      buttonRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      buttonRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      buttonRefs.current[PIPELINE_STAGES.length - 1]?.focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void updateStatus(stage);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}
        role="group"
        aria-label="Mail status pipeline: Draft, Sent, Opened, Replied"
      >
        {PIPELINE_STAGES.map((stage, index) => {
          const isCurrent = currentIndex === index;
          const isCompleted = !isDraftState && index <= currentIndex;
          const isReached = index <= currentIndex;
          const connectorIsActive = !isDraftState && index < currentIndex;
          const stageColor = PIPELINE_STAGE_COLOR[stage.key];
          const StageIcon = PIPELINE_STAGE_ICON[stage.key];
          const shouldFillStage = isCompleted || (isCurrent && stage.key === "draft");
          const glow = isCurrent ? buildGlow(stageColor) : undefined;

          return (
            <div key={stage.key} className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
              <div className="group relative">
                <button
                  ref={(element) => {
                    buttonRefs.current[index] = element;
                  }}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void updateStatus(stage.key)}
                  onKeyDown={(event) => handleKeyDown(event, index, stage.key)}
                  className={cn(
                    "flex items-center justify-center rounded-full border bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FF7B7B]/50 disabled:cursor-not-allowed disabled:opacity-70",
                    compact ? "h-5 w-5" : "h-6 w-6",
                    shouldFillStage
                      ? "border-transparent"
                      : "border-[#D1D5DB] hover:border-[#FF7B7B]/60",
                    isReached && "scale-[1.04]",
                    isCurrent && "scale-[1.1]"
                  )}
                  style={{
                    ...(shouldFillStage ? { backgroundColor: stageColor } : {}),
                    ...(glow ? { boxShadow: glow } : {}),
                  }}
                  aria-label={`Set stage to ${stage.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                  title={stage.label}
                >
                  <StageIcon
                    className={cn(
                      "transition-all",
                      compact ? "h-2.5 w-2.5" : "h-3 w-3",
                      shouldFillStage ? "text-white" : "text-slate-400",
                      isReached && !shouldFillStage && "text-slate-600",
                      isCurrent && "scale-110"
                    )}
                  />
                </button>

                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block group-focus-within:block">
                  {stage.label}
                </span>
              </div>

              {index < PIPELINE_STAGES.length - 1 && (
                <div
                  className={cn("flex items-center", compact ? "gap-0.5" : "gap-1")}
                  aria-hidden
                  style={connectorIsActive ? { color: stageColor } : undefined}
                >
                  <span className={connectorLineClasses(connectorIsActive, compact)} />
                  <span className={connectorArrowClasses(connectorIsActive, compact)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
