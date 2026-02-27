"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Progress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/Sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import {
  Mail,
  Clock,
  ClipboardList,
  MessageSquare,
  Braces,
  Sparkles,
  Paperclip,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react";
import {
  SequenceStep,
  StepType,
  StepAttachment,
} from "@/lib/types/sequence";
import { createClient } from "@/lib/supabase/client";
import { usePersona } from "@/context/PersonaContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_TYPE_OPTIONS: { type: StepType; label: string; icon: React.ReactNode }[] = [
  { type: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { type: "wait", label: "Wait", icon: <Clock className="h-4 w-4" /> },
  { type: "task", label: "Task", icon: <ClipboardList className="h-4 w-4" /> },
  { type: "linkedin", label: "LinkedIn", icon: <MessageSquare className="h-4 w-4" /> },
];

const STEP_TYPE_COLORS: Record<StepType, string> = {
  email: "text-blue-600 bg-blue-50 border-blue-200",
  wait: "text-amber-600 bg-amber-50 border-amber-200",
  task: "text-purple-600 bg-purple-50 border-purple-200",
  linkedin: "text-sky-600 bg-sky-50 border-sky-200",
};

const CONDITION_OPTIONS = [
  { value: "always", label: "Always proceed" },
  { value: "no_reply", label: "Only if contact has NOT replied" },
  { value: "opened", label: "Only if contact opened previous email" },
  { value: "clicked", label: "Only if contact clicked a link" },
];

const VARIABLES = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "company", label: "Company" },
  { key: "job_title", label: "Job Title" },
  { key: "email", label: "Email" },
  { key: "custom_note", label: "Custom Note" },
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HOURS = [
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 11, label: "11:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 13, label: "1:00 PM" },
  { value: 14, label: "2:00 PM" },
  { value: 15, label: "3:00 PM" },
  { value: 16, label: "4:00 PM" },
  { value: 17, label: "5:00 PM" },
  { value: 18, label: "6:00 PM" },
  { value: 19, label: "7:00 PM" },
  { value: 20, label: "8:00 PM" },
  { value: 21, label: "9:00 PM" },
  { value: 22, label: "10:00 PM" },
];

const SAMPLE_DATA: Record<string, string> = {
  first_name: "Sarah",
  last_name: "Johnson",
  company: "Acme Corp",
  job_title: "Engineering Manager",
  email: "sarah@acme.com",
  custom_note: "[Your custom note]",
  firstName: "Sarah",
  lastName: "Johnson",
  role: "Engineering Manager",
  userFirstName: "Alex",
  userLastName: "Smith",
};

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "video/mp4",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderPreview(body: string): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE_DATA[key] ?? `{{${key}}}`);
}

function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface StepConfigPanelProps {
  step: SequenceStep;
  stepIndex: number;
  totalSteps: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: SequenceStep) => void;
  templates?: Array<{ id: string; name: string; subject: string; body: string }>;
}

export function StepConfigPanel({
  step: initialStep,
  stepIndex,
  totalSteps,
  isOpen,
  onClose,
  onSave,
  templates = [],
}: StepConfigPanelProps) {
  const { isSalesRep } = usePersona();
  // ── Step identity ──────────────────────────────────────────────────────────
  const [stepType, setStepType] = useState<StepType>(initialStep.stepType ?? "email");
  const [stepName, setStepName] = useState(
    initialStep.step_name ?? `${capitalize(initialStep.stepType ?? "email")} ${stepIndex + 1}`
  );

  // ── Timing ─────────────────────────────────────────────────────────────────
  const [delayValue, setDelayValue] = useState(initialStep.delay_days);
  const [delayUnit, setDelayUnit] = useState<"hours" | "days">("days");
  const [sendOnDays, setSendOnDays] = useState<string[]>(
    initialStep.send_on_days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]
  );
  const [sendFromHour, setSendFromHour] = useState(initialStep.send_from_hour ?? 9);
  const [sendToHour, setSendToHour] = useState(initialStep.send_to_hour ?? 18);
  const [conditionType, setConditionType] = useState(initialStep.conditionType ?? "always");

  // ── Compose ────────────────────────────────────────────────────────────────
  const [subject, setSubject] = useState(initialStep.subject);
  const [body, setBody] = useState(initialStep.body);
  const [enhancing, setEnhancing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── Attachments ────────────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<StepAttachment[]>(
    initialStep.attachments ?? []
  );
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Stop conditions ────────────────────────────────────────────────────────
  const [stopOnReply, setStopOnReply] = useState(initialStep.stop_on_reply ?? true);
  const [stopOnBounce, setStopOnBounce] = useState(initialStep.stop_on_bounce ?? true);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const availableStepTypeOptions = useMemo(
    () =>
      isSalesRep
        ? STEP_TYPE_OPTIONS
        : STEP_TYPE_OPTIONS.filter(({ type }) => type !== "linkedin"),
    [isSalesRep]
  );

  const isLinkedInStep = stepType === "linkedin" && isSalesRep;

  useEffect(() => {
    if (!isSalesRep && stepType === "linkedin") {
      setStepType("email");
    }
  }, [isSalesRep, stepType]);

  const insertAtCursor = useCallback(
    (variable: string) => {
      const el = bodyRef.current;
      const token = `{{${variable}}}`;
      if (!el) {
        setBody((prev) => prev + token);
        return;
      }
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const newBody = body.slice(0, start) + token + body.slice(end);
      setBody(newBody);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    },
    [body]
  );

  const insertSubjectVariable = useCallback((variable: string) => {
    setSubject((prev) => prev + `{{${variable}}}`);
  }, []);

  const enhanceDraft = async () => {
    if (!body.trim()) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/enhance-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: body }),
      });
      if (res.ok) {
        const data = await res.json();
        const enhanced = data.enhanced || data.result || data.draft;
        if (enhanced) setBody(enhanced);
      }
    } catch {
      // Enhancement failed silently — original body kept
    } finally {
      setEnhancing(false);
    }
  };

  const addFiles = (files: File[]) => {
    const valid = files.filter(
      (f) => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    setAttachments((prev) => {
      const combined = [
        ...prev,
        ...valid.map((f) => ({
          id: generateAttachmentId(),
          name: f.name,
          size: f.size,
          type: "other" as const,
          localFile: f,
        })),
      ].slice(0, MAX_FILES);
      return combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setUploadProgress((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateAttachmentType = (
    id: string,
    type: StepAttachment["type"]
  ) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, type } : a))
    );
  };

  const toggleDay = (day: string) => {
    setSendOnDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const uploadAttachments = async (): Promise<StepAttachment[]> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? "anonymous";
    const stepId = initialStep.id;

    const results: StepAttachment[] = [];
    for (const att of attachments) {
      if (att.url || !att.localFile) {
        results.push(att);
        continue;
      }
      setUploadProgress((prev) => ({ ...prev, [att.id]: 30 }));
      const filePath = `sequence-attachments/${userId}/${stepId}/${att.name}`;
      const { error } = await supabase.storage
        .from("sequence-attachments")
        .upload(filePath, att.localFile, { upsert: true });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from("sequence-attachments")
          .getPublicUrl(filePath);
        setUploadProgress((prev) => ({ ...prev, [att.id]: 100 }));
        results.push({ ...att, url: publicUrl, localFile: undefined });
      } else {
        setUploadProgress((prev) => ({ ...prev, [att.id]: 0 }));
        results.push(att);
      }
    }
    return results;
  };

  const handleSave = async () => {
    setSaving(true);
    const uploadedAttachments = await uploadAttachments();
    const delayDays =
      delayUnit === "hours" ? Math.max(1, Math.round(delayValue / 24)) : delayValue;

    const updatedStep: SequenceStep = {
      ...initialStep,
      stepType,
      conditionType: conditionType as SequenceStep["conditionType"],
      step_name: stepName,
      delay_days: delayDays,
      send_on_days: sendOnDays,
      send_from_hour: sendFromHour,
      send_to_hour: sendToHour,
      subject:
        stepType === "wait"
          ? `Wait ${delayDays} day${delayDays !== 1 ? "s" : ""}`
          : stepType === "linkedin" && isSalesRep
          ? "LinkedIn Message"
          : subject,
      body:
        stepType === "wait"
          ? `Automated wait — ${delayDays} day${delayDays !== 1 ? "s" : ""} before next step.`
          : body,
      stop_on_reply: stopOnReply,
      stop_on_bounce: stopOnBounce,
      attachments: uploadedAttachments,
    };

    onSave(updatedStep);
    setSaving(false);
  };

  const isComposable = stepType === "email" || isLinkedInStep;

  const canSave =
    stepType === "wait" ||
    stepType === "task" ||
    (isLinkedInStep && body.trim().length > 0) ||
    (stepType === "email" && subject.trim().length > 0 && body.trim().length > 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Configure Step</SheetTitle>
            <Badge variant="outline" className="text-xs font-normal">
              Step {stepIndex + 1} of {totalSteps}
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Configure the settings for this sequence step
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Section 1: Step Identity */}
          <div className="space-y-3">
            {/* Type selector */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                Step Type
              </Label>
              <div className="flex gap-2">
                {availableStepTypeOptions.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setStepType(type)}
                    className={`flex flex-col items-center gap-1 flex-1 py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                      stepType === type
                        ? STEP_TYPE_COLORS[type]
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step name */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
                Step Name
              </Label>
              <Input
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                placeholder="e.g., Initial Outreach"
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Section 2: Timing & Conditions */}
          <CollapsibleSection title="Timing & Conditions" defaultOpen={true}>
            {/* Delay */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Send after
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={delayValue}
                  onChange={(e) => setDelayValue(parseInt(e.target.value) || 0)}
                  className="h-8 w-20 text-sm"
                />
                <Select
                  value={delayUnit}
                  onValueChange={(v) => setDelayUnit(v as "hours" | "days")}
                >
                  <SelectTrigger className="h-8 text-sm w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">hours</SelectItem>
                    <SelectItem value="days">days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days of week */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Send on days
              </Label>
              <div className="flex gap-1">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                      sendOnDays.includes(day)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {day.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>

            {/* Hours range */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Send between hours
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={String(sendFromHour)}
                  onValueChange={(v) => setSendFromHour(Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={String(h.value)}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Select
                  value={String(sendToHour)}
                  onValueChange={(v) => setSendToHour(Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h.value} value={String(h.value)}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Condition */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Condition trigger
              </Label>
              <Select value={conditionType} onValueChange={(v) => setConditionType(v as typeof conditionType)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CollapsibleSection>

          {/* Section 3: Email Compose (only for email / linkedin) */}
          {isComposable && (
            <CollapsibleSection title="Message Compose" defaultOpen={true}>
              {/* Subject (email only) */}
              {stepType === "email" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Subject Line
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Quick question about {{company}}"
                      className="h-8 text-sm flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                          <Braces className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="end">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Insert variable
                        </p>
                        <div className="flex flex-col gap-1">
                          {VARIABLES.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertSubjectVariable(v.key)}
                              className="text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                            >
                              <span className="font-mono text-primary">
                                {`{{${v.key}}}`}
                              </span>
                              <span className="text-muted-foreground ml-1.5">
                                {v.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {isLinkedInStep ? "Message" : "Body"}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Braces className="h-3 w-3" />
                          Variables
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="end">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          Insert at cursor
                        </p>
                        <div className="flex flex-col gap-1">
                          {VARIABLES.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertAtCursor(v.key)}
                              className="text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                            >
                              <span className="font-mono text-primary">
                                {`{{${v.key}}}`}
                              </span>
                              <span className="text-muted-foreground ml-1.5">
                                {v.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={enhanceDraft}
                      disabled={!body.trim() || enhancing}
                      type="button"
                    >
                      {enhancing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      AI Enhance
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowPreview((v) => !v)}
                      type="button"
                    >
                      {showPreview ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {showPreview ? (
                  <div className="border rounded-md p-3 bg-muted min-h-[180px] text-sm whitespace-pre-wrap">
                    {renderPreview(body) || (
                      <span className="text-muted-foreground italic">
                        Nothing to preview yet
                      </span>
                    )}
                  </div>
                ) : (
                  <Textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      isLinkedInStep
                        ? `Hi {{first_name}}, I came across your profile at {{company}}...`
                        : `Hi {{first_name}},\n\nI noticed you work at {{company}} as {{job_title}}...\n\nBest,\n{{first_name}}`
                    }
                    className="min-h-[180px] text-sm font-mono resize-none"
                  />
                )}
                {isLinkedInStep && (
                  <p className="text-xs text-muted-foreground mt-1">
                    LinkedIn connection request messages are limited to 300 characters.
                  </p>
                )}
              </div>

              {/* Template picker */}
              {stepType === "email" && templates.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Load from template
                  </Label>
                  <Select
                    value="none"
                    onValueChange={(id) => {
                      const t = templates.find((t) => t.id === id);
                      if (t) {
                        setSubject(t.subject);
                        setBody(t.body);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Section 4: Attachments */}
          <CollapsibleSection title="Attachments" defaultOpen={false}>
            {/* Drop zone */}
            {attachments.length < MAX_FILES && (
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-primary/60 bg-primary/5"
                    : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Drop files here or{" "}
                  <span className="text-primary font-medium">click to browse</span>
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  PDF, DOCX, PNG, JPG, MP4 · max 10MB · up to {MAX_FILES} files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* Attached files */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div key={att.id} className="border rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium truncate flex-1">{att.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatBytes(att.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Select
                      value={att.type}
                      onValueChange={(v) =>
                        updateAttachmentType(att.id, v as StepAttachment["type"])
                      }
                    >
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resume">Resume</SelectItem>
                        <SelectItem value="portfolio">Portfolio</SelectItem>
                        <SelectItem value="case_study">Case Study</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {uploadProgress[att.id] !== undefined && (
                      <Progress value={uploadProgress[att.id]} className="h-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Section 5: Stop Conditions */}
          <CollapsibleSection title="Stop Conditions" defaultOpen={true}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stop if contact replies</p>
                  <p className="text-xs text-muted-foreground">
                    End the sequence once a reply is detected.
                  </p>
                </div>
                <Switch
                  checked={stopOnReply}
                  onCheckedChange={setStopOnReply}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stop if email bounces</p>
                  <p className="text-xs text-muted-foreground">
                    Pause the sequence if a bounce is detected.
                  </p>
                </div>
                <Switch
                  checked={stopOnBounce}
                  onCheckedChange={setStopOnBounce}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 6: Preview */}
          {isComposable && body.trim() && (
            <CollapsibleSection title="Preview Email" defaultOpen={false}>
              <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                {stepType === "email" && (
                  <p className="font-medium text-xs text-muted-foreground">
                    Subject: {renderPreview(subject) || "(no subject)"}
                  </p>
                )}
                <div className="whitespace-pre-wrap text-sm">
                  {renderPreview(body)}
                </div>
                <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  Preview uses sample data: Sarah Johnson · Acme Corp · Engineering Manager
                </p>
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} type="button" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Step
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
