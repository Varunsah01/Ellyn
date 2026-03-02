"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Sparkles } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  SequenceBuilderStep,
  VisualSequenceBuilder,
} from "@/components/sequences/VisualSequenceBuilder";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { usePersona } from "@/context/PersonaContext";
import { showToast } from "@/lib/toast";

type TemplatePersona = "job_seeker" | "smb_sales";

type TemplateStepDefinition = {
  name: string;
  day: number;
  subject: string;
  body: string;
};

type SequenceTemplate = {
  id: string;
  name: string;
  description: string;
  persona: TemplatePersona;
  steps: TemplateStepDefinition[];
};

const TEMPLATE_LIBRARY: SequenceTemplate[] = [
  {
    id: "hiring-manager-outreach",
    persona: "job_seeker",
    name: "Hiring Manager Outreach",
    description: "Reach hiring managers with a concise intro and two follow-ups.",
    steps: [
      {
        name: "Intro Email",
        day: 0,
        subject: "Quick intro and interest in your open role",
        body: "Hi {{firstName}}, I am reaching out because your team at {{company}} is hiring. I would love to share why I am a strong fit.",
      },
      {
        name: "Follow-up",
        day: 5,
        subject: "Following up on my application",
        body: "Hi {{firstName}}, I wanted to follow up on my note from last week. I remain very interested in the opportunity at {{company}}.",
      },
      {
        name: "Final Touch",
        day: 10,
        subject: "Final follow-up",
        body: "Hi {{firstName}}, this is my final follow-up. If there is still interest, I would be glad to share additional context about my background.",
      },
    ],
  },
  {
    id: "recruiter-connection",
    persona: "job_seeker",
    name: "Recruiter Connection",
    description: "Engage recruiters with context, resume, and value-add follow-up.",
    steps: [
      {
        name: "Connection Request Email",
        day: 0,
        subject: "Introduction from a candidate interested in {{company}}",
        body: "Hi {{firstName}}, I am exploring opportunities aligned with my background and would value connecting with you.",
      },
      {
        name: "Follow-up with Resume",
        day: 3,
        subject: "Sharing my resume for relevant openings",
        body: "Hi {{firstName}}, sharing my resume and a short summary of relevant results in case there is a fit for your current openings.",
      },
      {
        name: "Value Add",
        day: 7,
        subject: "One more thought on how I can help",
        body: "Hi {{firstName}}, I wanted to share one concrete way I can contribute based on what {{company}} is building.",
      },
    ],
  },
  {
    id: "referral-request",
    persona: "job_seeker",
    name: "Referral Request",
    description: "Ask for a referral respectfully, then follow up with gratitude.",
    steps: [
      {
        name: "Initial Ask",
        day: 0,
        subject: "Could I ask for your advice on a referral?",
        body: "Hi {{firstName}}, I am applying to {{company}} and would appreciate your advice on whether a referral could make sense.",
      },
      {
        name: "Thank You / Follow-up",
        day: 4,
        subject: "Thank you for your time",
        body: "Hi {{firstName}}, thank you again for considering my request. I appreciate your time and any guidance you can share.",
      },
    ],
  },
  {
    id: "saas-cold-outreach",
    persona: "smb_sales",
    name: "SaaS Cold Outreach",
    description: "Run a full cold sequence with proof, objection handling, and breakup.",
    steps: [
      {
        name: "Intro + Value Prop",
        day: 0,
        subject: "Idea to improve {{company}}'s workflow",
        body: "Hi {{firstName}}, I noticed {{company}} is growing quickly. We help teams like yours reduce manual workflow time with a simple rollout.",
      },
      {
        name: "Case Study",
        day: 3,
        subject: "How a similar team achieved results",
        body: "Hi {{firstName}}, sharing a short case study where a similar team improved response speed and reduced operational overhead.",
      },
      {
        name: "Objection Handling",
        day: 7,
        subject: "Common concerns and quick answers",
        body: "Hi {{firstName}}, teams usually ask about implementation effort and ROI. Happy to share concise answers based on your priorities.",
      },
      {
        name: "Breakup Email",
        day: 14,
        subject: "Should I close the loop?",
        body: "Hi {{firstName}}, I have not heard back, so I will close this thread unless a conversation is still useful.",
      },
    ],
  },
  {
    id: "agency-lead-gen",
    persona: "smb_sales",
    name: "Agency Lead Gen",
    description: "Introduce your agency, share portfolio proof, and close with a CTA.",
    steps: [
      {
        name: "Intro",
        day: 0,
        subject: "Quick intro from our agency",
        body: "Hi {{firstName}}, I lead growth partnerships and wanted to share how we support teams like {{company}} with pipeline outcomes.",
      },
      {
        name: "Portfolio Follow-up",
        day: 4,
        subject: "A few relevant portfolio examples",
        body: "Hi {{firstName}}, sharing examples of recent work so you can quickly assess fit for your current goals.",
      },
      {
        name: "Final CTA",
        day: 9,
        subject: "Would a short call be useful?",
        body: "Hi {{firstName}}, open to a 15-minute call next week to discuss whether this approach could work for {{company}}?",
      },
    ],
  },
  {
    id: "partnership-proposal",
    persona: "smb_sales",
    name: "Partnership Proposal",
    description: "Pitch a strategic partnership with one focused follow-up.",
    steps: [
      {
        name: "Intro",
        day: 0,
        subject: "Partnership idea for {{company}}",
        body: "Hi {{firstName}}, I wanted to propose a partnership that could open a new channel for both teams.",
      },
      {
        name: "Follow-up",
        day: 5,
        subject: "Following up on partnership idea",
        body: "Hi {{firstName}}, following up to see if exploring this partnership is timely for your team this quarter.",
      },
    ],
  },
];

type BuilderState = "gallery" | "builder";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toBuilderSteps(template: SequenceTemplate): SequenceBuilderStep[] {
  let previousDay = 0;

  return template.steps.map((step, index) => {
    const delay = index === 0 ? step.day : Math.max(0, step.day - previousDay);
    previousDay = step.day;

    return {
      id: generateId(),
      sequence_id: "",
      order: index + 1,
      step_order: index,
      type: "email",
      stepType: "email",
      step_name: step.name,
      subject: step.subject,
      body: step.body,
      delay_days: delay,
      send_on_days: [1, 2, 3, 4, 5],
      send_from_hour: 9,
      send_to_hour: 17,
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
      attachments: [],
      condition_type: null,
    };
  });
}

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorValue = (payload as { error?: unknown }).error;
    if (typeof errorValue === "string" && errorValue.trim()) {
      return errorValue;
    }
  }
  return fallback;
}

function resolveStepType(step: SequenceBuilderStep): "email" | "wait" | "condition" | "task" {
  if (step.type === "email" || step.type === "wait" || step.type === "condition" || step.type === "task") {
    return step.type;
  }
  if (step.stepType === "email" || step.stepType === "wait" || step.stepType === "condition" || step.stepType === "task") {
    return step.stepType;
  }
  return "email";
}

function toSendDays(value: SequenceBuilderStep["send_on_days"]): number[] {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5];

  const normalized = value
    .map((day) => {
      if (typeof day === "number") return day;
      if (typeof day === "string") {
        const parsed = Number(day);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })
    .filter((day): day is number => day !== null && day >= 0 && day <= 6);

  if (normalized.length === 0) {
    return [1, 2, 3, 4, 5];
  }

  return Array.from(new Set(normalized)).sort((a, b) => a - b);
}

export default function NewSequencePage() {
  const router = useRouter();
  const { persona } = usePersona();

  const [state, setState] = useState<BuilderState>("gallery");
  const [selectedTemplate, setSelectedTemplate] = useState<SequenceTemplate | null>(null);
  const [sequenceName, setSequenceName] = useState("");
  const [steps, setSteps] = useState<SequenceBuilderStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const personaTemplates = useMemo(
    () => TEMPLATE_LIBRARY.filter((template) => template.persona === persona),
    [persona]
  );

  const otherTemplates = useMemo(
    () => TEMPLATE_LIBRARY.filter((template) => template.persona !== persona),
    [persona]
  );

  const enterBuilderFromTemplate = (template: SequenceTemplate) => {
    setSequenceName(template.name);
    setSteps(toBuilderSteps(template));
    setState("builder");
  };

  const startFromScratch = () => {
    setSequenceName("");
    setSteps([]);
    setState("builder");
  };

  const handleSave = async () => {
    const trimmedName = sequenceName.trim();

    if (!trimmedName) {
      showToast.error("Sequence name is required");
      return;
    }

    if (steps.length === 0) {
      showToast.error("Add at least one step");
      return;
    }

    const payloadSteps = steps.map((step, index) => {
      const stepType = resolveStepType(step);
      const delayDays = Math.max(0, Number(step.delay_days ?? 0));
      const sendFrom = Math.min(23, Math.max(0, Number(step.send_from_hour ?? 9)));
      const sendTo = Math.min(23, Math.max(0, Number(step.send_to_hour ?? 17)));

      return {
        step_order: index,
        step_name: step.step_name?.trim() || `Step ${index + 1}`,
        step_type: stepType,
        subject: step.subject?.trim() || "",
        body: step.body?.trim() || "",
        delay_days: delayDays,
        send_on_days: toSendDays(step.send_on_days),
        send_from_hour: sendFrom,
        send_to_hour: sendTo,
        condition_type: stepType === "condition" ? step.condition_type ?? "opened" : null,
        attachments: Array.isArray(step.attachments) ? step.attachments : [],
      };
    });

    setIsSaving(true);

    try {
      const response = await fetch("/api/v1/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: "",
          steps: payloadSteps,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        sequence?: { id?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to save sequence"));
      }

      const sequenceId = payload.sequence?.id;
      if (!sequenceId) {
        throw new Error("Failed to create sequence");
      }

      showToast.success("Sequence created");
      router.push(`/dashboard/sequences/${sequenceId}`);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save sequence");
    } finally {
      setIsSaving(false);
    }
  };

  if (state === "builder") {
    return (
      <DashboardShell className="px-4 py-6 md:px-8">
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={() => setState("gallery")}>
            <ArrowLeft className="h-4 w-4" />
            Back to templates
          </Button>

          <PageHeader
            title="Build Sequence"
            description="Drag steps, configure timing, and save when ready."
          />

          <VisualSequenceBuilder
            sequenceName={sequenceName}
            onSequenceNameChange={setSequenceName}
            steps={steps}
            onChange={setSteps}
            onSave={handleSave}
            onCancel={() => setState("gallery")}
            isSaving={isSaving}
          />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <div className="space-y-6">
        <PageHeader
          title="New Sequence"
          description="Choose a template or start from scratch."
          actions={
            <Button type="button" onClick={startFromScratch}>
              <Sparkles className="h-4 w-4" />
              Start from Scratch
            </Button>
          }
        />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#2D2B55]">Recommended Templates</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {personaTemplates.map((template) => (
              <Card key={template.id} className="border-[#E6E4F2] bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-[#2D2B55]">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600">{template.steps.length} steps</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => enterBuilderFromTemplate(template)}>
                      Use Template
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setSelectedTemplate(template)}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#2D2B55]">Other Templates</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {otherTemplates.map((template) => (
              <Card key={template.id} className="border-[#E6E4F2] bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-[#2D2B55]">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600">{template.steps.length} steps</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => enterBuilderFromTemplate(template)}>
                      Use Template
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setSelectedTemplate(template)}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={Boolean(selectedTemplate)} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedTemplate?.steps.map((step, index) => (
              <div key={`${selectedTemplate.id}-${index}`} className="rounded-md border border-[#E6E4F2] p-3">
                <p className="text-sm font-medium text-[#2D2B55]">
                  Day {step.day}: {step.name}
                </p>
                <p className="mt-1 text-xs text-slate-600">{step.subject}</p>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!selectedTemplate) return;
                enterBuilderFromTemplate(selectedTemplate);
                setSelectedTemplate(null);
              }}
            >
              Use Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
