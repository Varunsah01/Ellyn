export type TemplateTone = "professional" | "casual" | "friendly" | "confident" | "humble";

export type TemplateRecord = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  tone: TemplateTone | null;
  is_ai_generated: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export function toToneLabel(tone: TemplateTone | null): string {
  const value = tone ?? "professional";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toneBadgeClassName(tone: TemplateTone | null): string {
  if (tone === "casual") return "border-blue-200 bg-blue-50 text-blue-700";
  if (tone === "friendly") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "confident") return "border-violet-200 bg-violet-50 text-violet-700";
  if (tone === "humble") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function normalizeTone(value: unknown): TemplateTone {
  if (
    value === "professional" ||
    value === "casual" ||
    value === "friendly" ||
    value === "confident" ||
    value === "humble"
  ) {
    return value;
  }
  return "professional";
}

export const TONE_OPTIONS: TemplateTone[] = [
  "professional",
  "casual",
  "friendly",
  "confident",
  "humble",
];
