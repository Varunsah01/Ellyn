"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { PasswordStrengthResult } from "@/lib/validation/password";

interface PasswordStrengthIndicatorProps {
  result: PasswordStrengthResult;
  showRequirements?: boolean;
}

const SCORE_SEGMENT_CLASSES: Record<number, string> = {
  0: "bg-red-500",
  1: "bg-red-500",
  2: "bg-yellow-500",
  3: "bg-emerald-500",
  4: "bg-emerald-600",
};

const LABEL_CLASSES: Record<PasswordStrengthResult["label"], string> = {
  "Very Weak": "text-red-600",
  Weak: "text-red-600",
  Fair: "text-yellow-600",
  Strong: "text-emerald-600",
  "Very Strong": "text-emerald-700",
};

/**
 * Render the PasswordStrengthIndicator component.
 * @param {PasswordStrengthIndicatorProps} props - Component props.
 * @returns {JSX.Element} JSX output for PasswordStrengthIndicator.
 * @example
 * <PasswordStrengthIndicator result={validatePasswordStrength("Abcd1234!")} />
 */
export function PasswordStrengthIndicator({
  result,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const activeSegments = Math.max(0, Math.min(4, result.score));
  const barColorClass = SCORE_SEGMENT_CLASSES[result.score];

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">Password strength</span>
        <span className={`font-semibold ${LABEL_CLASSES[result.label]}`}>{result.label}</span>
      </div>

      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => {
          const isFilled = index < activeSegments;
          return (
            <div
              key={`segment-${index}`}
              className={`h-1.5 rounded-full transition-colors ${
                isFilled ? barColorClass : "bg-slate-200"
              }`}
            />
          );
        })}
      </div>

      {showRequirements && (
        <ul className="space-y-1 text-xs">
          {result.requirements.map((requirement) => (
            <li
              key={requirement.id}
              className={`flex items-center gap-2 ${
                requirement.met ? "text-emerald-700" : "text-slate-600"
              }`}
            >
              {requirement.met ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{requirement.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

