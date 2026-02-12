"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { TRACKER_STATUS_COLORS } from "@/lib/tracker-v2";

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
  draft: TRACKER_STATUS_COLORS.new.dot,
  sent: TRACKER_STATUS_COLORS.contacted.dot,
  opened: TRACKER_STATUS_COLORS.no_response.dot,
  replied: TRACKER_STATUS_COLORS.replied.dot,
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
          const connectorIsActive = !isDraftState && index < currentIndex;
          const stageColor = PIPELINE_STAGE_COLOR[stage.key];

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
                    "rounded-full border bg-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FF7B7B]/50 disabled:cursor-not-allowed disabled:opacity-70",
                    compact ? "h-5 w-5" : "h-6 w-6",
                    isCompleted
                      ? "border-transparent"
                      : "border-[#D1D5DB] hover:border-[#FF7B7B]/60",
                    isCurrent && "border-2 shadow-[0_0_0_3px_rgba(255,123,123,0.16)]"
                  )}
                  style={isCompleted ? { backgroundColor: stageColor } : undefined}
                  aria-label={`Set stage to ${stage.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                  title={stage.label}
                />

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
