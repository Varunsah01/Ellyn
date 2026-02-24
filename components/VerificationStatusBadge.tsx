import { CheckCircle2, XCircle, HelpCircle, Loader2 } from "lucide-react";

export type EmailVerificationStatus =
  | "verified"
  | "smtp_verified"
  | "pattern_confidence"
  | "invalid"
  | "unverified"
  | "checking";

const config: Record<
  EmailVerificationStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  verified: {
    label: "Verified",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200",
  },
  smtp_verified: {
    label: "SMTP \u2713",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200",
  },
  pattern_confidence: {
    label: "Pattern Match",
    icon: <HelpCircle className="h-3 w-3" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200",
  },
  invalid: {
    label: "Invalid",
    icon: <XCircle className="h-3 w-3" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200",
  },
  unverified: {
    label: "Unverified",
    icon: <HelpCircle className="h-3 w-3" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200",
  },
  checking: {
    label: "Checking...",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200",
  },
};

interface VerificationStatusBadgeProps {
  status: EmailVerificationStatus;
}

export function VerificationStatusBadge({ status }: VerificationStatusBadgeProps) {
  const { label, icon, className } = config[status];
  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}

