"use client";

interface EmailConfidenceCellProps {
  email: string;
  confidence?: number;
  verified?: boolean;
  emailSource?: string;
  emailPattern?: string;
}

function getConfidenceStyle(confidence: number, verified: boolean) {
  if (confidence >= 80) {
    return {
      bg: "#D1FAE5",
      text: "#065F46",
      label: verified ? "Verified" : "High",
    };
  }
  if (confidence >= 50) {
    return { bg: "#FEF3C7", text: "#92400E", label: "Medium" };
  }
  return { bg: "#FEE2E2", text: "#991B1B", label: "Low" };
}

export function EmailConfidenceCell({
  email,
  confidence,
  verified = false,
  emailSource,
  emailPattern,
}: EmailConfidenceCellProps) {
  if (!email) {
    return <span className="text-muted-foreground text-xs italic">—</span>;
  }

  const pct = confidence ?? 0;
  const hasBadge = confidence !== undefined;
  const { bg, text, label } = hasBadge
    ? getConfidenceStyle(pct, verified)
    : { bg: "", text: "", label: "" };

  const tooltipLines: string[] = [];
  if (confidence !== undefined) tooltipLines.push(`Confidence: ${confidence}%`);
  if (emailSource) tooltipLines.push(`Source: ${emailSource}`);
  if (emailPattern) tooltipLines.push(`Pattern: ${emailPattern}`);
  const title = tooltipLines.join(" · ");

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-sm truncate" title={title}>
        {email}
      </span>
      {hasBadge && (
        <span
          className="inline-flex w-fit items-center rounded-full px-1.5 py-0 text-[10px] font-semibold leading-4"
          style={{ backgroundColor: bg, color: text }}
          title={title}
        >
          {label}
        </span>
      )}
    </div>
  );
}
