"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import {
  Mail,
  Clock,
  ClipboardList,
  MessageSquare,
  Search,
  ArrowRight,
  ChevronRight,
  Eye,
  Plus,
} from "lucide-react";
import { SequenceStep, StepType } from "@/lib/types/sequence";
import { usePersona } from "@/context/PersonaContext";
import { generateStepId } from "@/lib/utils/sequence-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateCategory = "job_search" | "sales";

interface TemplateStep {
  order: number;
  delay_days: number;
  stepType: StepType;
  subject: string;
  body: string;
  step_name?: string;
}

interface SequenceTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  steps: TemplateStep[];
}

type FilterTab = "all" | "job_search" | "sales";

// ─── Built-in Templates ───────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: SequenceTemplate[] = [
  // ── JOB SEARCH ──────────────────────────────────────────────────────────────
  {
    id: "job-cold-hiring-manager",
    name: "Cold Outreach to Hiring Manager",
    category: "job_search",
    description:
      "Reach out to a hiring manager at your target company even without a posted role.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Initial Outreach",
        subject: "Quick question about {{company}}",
        body: `Hi {{first_name}},

I came across your profile while researching {{company}} — I'm really impressed by what your team is building.

I'm a [your role] with experience in [key skill] and would love to explore if there's a fit on your team. Would you be open to a 15-minute call this week?

Best,
{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 4,
        stepType: "wait",
        step_name: "Wait 4 days",
        subject: "Wait 4 days",
        body: "Automated wait — 4 days before next step.",
      },
      {
        order: 3,
        delay_days: 4,
        stepType: "email",
        step_name: "Follow-up",
        subject: "Re: Quick question about {{company}}",
        body: `Hi {{first_name}},

Just following up on my note from last week. I know inboxes get busy — happy to connect whenever works for you.

{{sender_name}}`,
      },
      {
        order: 4,
        delay_days: 7,
        stepType: "task",
        step_name: "Check LinkedIn",
        subject: "Check LinkedIn",
        body: "Check if {{first_name}} viewed your profile. If yes, send a connection request.",
      },
      {
        order: 5,
        delay_days: 7,
        stepType: "email",
        step_name: "Final Note",
        subject: "Last note — {{company}} opportunity",
        body: `Hi {{first_name}},

I'll keep this short — I'm very interested in contributing to {{company}}'s work on [area]. If timing isn't right now, I completely understand. Either way, I'd love to stay connected.

{{sender_name}}`,
      },
    ],
  },
  {
    id: "job-recruiter-outreach",
    name: "Recruiter Introduction",
    category: "job_search",
    description:
      "Introduce yourself to a recruiter at your target company for pipeline consideration.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Introduction",
        subject: "Exploring opportunities at {{company}}",
        body: `Hi {{first_name}},

I'm reaching out because I've been following {{company}}'s growth and would love to be considered for future opportunities on your team.

I'm a [your role] with [X years] of experience in [key skills]. My background includes [brief achievement]. I'd love to chat if you have 15 minutes.

Best,
{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 5,
        stepType: "wait",
        step_name: "Wait 5 days",
        subject: "Wait 5 days",
        body: "Automated wait — 5 days before next step.",
      },
      {
        order: 3,
        delay_days: 5,
        stepType: "email",
        step_name: "Follow-up",
        subject: "Following up — opportunities at {{company}}",
        body: `Hi {{first_name}},

Just a quick follow-up on my previous note. I remain very interested in {{company}} and would welcome any chance to connect, even briefly.

Thanks for your time,
{{sender_name}}`,
      },
    ],
  },
  {
    id: "job-referral-request",
    name: "Referral Request from Mutual Connection",
    category: "job_search",
    description: "Ask a mutual connection for a warm intro to a hiring manager.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Referral Ask",
        subject: "Quick favor — intro to {{company}}",
        body: `Hi {{first_name}},

Hope you're doing well! I'm actively exploring my next role and {{company}} is at the top of my list.

I noticed you're connected with [hiring manager's name] there. Would you be comfortable making a brief intro? Happy to draft a message for you to forward — totally understand if it's not a good fit.

Thanks so much,
{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 4,
        stepType: "wait",
        step_name: "Wait 4 days",
        subject: "Wait 4 days",
        body: "Automated wait — 4 days before next step.",
      },
      {
        order: 3,
        delay_days: 4,
        stepType: "email",
        step_name: "Gentle Follow-up",
        subject: "Re: Quick favor — {{company}}",
        body: `Hi {{first_name}},

Just circling back in case my earlier note got buried. No worries if it's not convenient — I appreciate your time either way!

{{sender_name}}`,
      },
    ],
  },
  // ── SALES ───────────────────────────────────────────────────────────────────
  {
    id: "sales-cold-intro",
    name: "Cold Intro — Problem-Led",
    category: "sales",
    description:
      "Open with the pain point, not your product. High reply rates for SMB outreach.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Problem-Led Intro",
        subject: "Noticed a challenge at {{company}}",
        body: `Hi {{first_name}},

Most {{job_title}}s I talk to are dealing with [specific pain point] — does that resonate at {{company}}?

We helped [similar company] solve this in [timeframe], resulting in [result]. Happy to share how.

Worth a quick call?

{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 3,
        stepType: "wait",
        step_name: "Wait 3 days",
        subject: "Wait 3 days",
        body: "Automated wait — 3 days before next step.",
      },
      {
        order: 3,
        delay_days: 3,
        stepType: "email",
        step_name: "Value Add",
        subject: "Re: {{company}}",
        body: `Hi {{first_name}},

Sharing a quick resource that might be helpful: [link or one-sentence insight relevant to their industry].

No pitch, just thought it might be useful given your work at {{company}}.

{{sender_name}}`,
      },
      {
        order: 4,
        delay_days: 5,
        stepType: "wait",
        step_name: "Wait 5 days",
        subject: "Wait 5 days",
        body: "Automated wait — 5 days before next step.",
      },
      {
        order: 5,
        delay_days: 5,
        stepType: "email",
        step_name: "Break-up",
        subject: "Final note — {{company}}",
        body: `Hi {{first_name}},

I'll make this my last note. If solving [pain point] ever becomes a priority for {{company}}, I'd love to reconnect.

Take care,
{{sender_name}}`,
      },
    ],
  },
  {
    id: "sales-case-study",
    name: "Case Study Share Sequence",
    category: "sales",
    description: "Lead with a relevant success story from a similar company.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Case Study Intro",
        subject: "How [Similar Company] achieved [result] — relevant for {{company}}",
        body: `Hi {{first_name}},

I wanted to share a quick case study that might be relevant for {{company}}.

[Similar Company], a [industry] company like yours, used [our solution] to achieve [specific result] in [timeframe].

Would it be valuable to explore if we could do the same for {{company}}?

{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 4,
        stepType: "wait",
        step_name: "Wait 4 days",
        subject: "Wait 4 days",
        body: "Automated wait — 4 days before next step.",
      },
      {
        order: 3,
        delay_days: 4,
        stepType: "email",
        step_name: "Follow-up",
        subject: "Re: Case study for {{company}}",
        body: `Hi {{first_name}},

Just following up on the case study I shared. Happy to walk through it live if that would be more useful — 20 minutes on a call?

{{sender_name}}`,
      },
      {
        order: 4,
        delay_days: 6,
        stepType: "email",
        step_name: "Final Follow-up",
        subject: "Last follow-up — {{company}}",
        body: `Hi {{first_name}},

I'll leave it here. If the results I mentioned become relevant for {{company}} in the future, I'd love to reconnect.

{{sender_name}}`,
      },
    ],
  },
  {
    id: "sales-meeting-request",
    name: "Meeting Request (Direct)",
    category: "sales",
    description: "Short, direct sequence optimized for booking discovery calls.",
    steps: [
      {
        order: 1,
        delay_days: 0,
        stepType: "email",
        step_name: "Direct Ask",
        subject: "15 minutes for {{company}}?",
        body: `Hi {{first_name}},

I'll be brief: we help {{job_title}}s at companies like {{company}} with [specific outcome].

Would you have 15 minutes this week to see if it's a fit?

{{sender_name}}`,
      },
      {
        order: 2,
        delay_days: 4,
        stepType: "wait",
        step_name: "Wait 4 days",
        subject: "Wait 4 days",
        body: "Automated wait — 4 days before next step.",
      },
      {
        order: 3,
        delay_days: 4,
        stepType: "email",
        step_name: "Still Open?",
        subject: "Still open for a call?",
        body: `Hi {{first_name}},

Checking in one more time — still happy to show you a quick demo if timing works.

Just reply "yes" and I'll send a calendar link.

{{sender_name}}`,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateDays(steps: TemplateStep[]): number {
  return steps.reduce((acc, s) => acc + s.delay_days, 0);
}

function templateToSequenceSteps(steps: TemplateStep[]): SequenceStep[] {
  return steps.map((s) => ({
    id: generateStepId(),
    sequence_id: "",
    order: s.order,
    delay_days: s.delay_days,
    stepType: s.stepType,
    conditionType: "always" as const,
    step_name: s.step_name,
    subject: s.subject,
    body: s.body,
    status: "draft" as const,
    stop_on_reply: true,
    stop_on_bounce: true,
    send_on_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    send_from_hour: 9,
    send_to_hour: 18,
  }));
}

const STEP_TYPE_ICONS: Record<StepType, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />,
  wait: <Clock className="h-3 w-3" />,
  task: <ClipboardList className="h-3 w-3" />,
  linkedin: <MessageSquare className="h-3 w-3" />,
};

const STEP_TYPE_COLORS: Record<StepType, string> = {
  email: "bg-blue-100 text-blue-600",
  wait: "bg-amber-100 text-amber-600",
  task: "bg-purple-100 text-purple-600",
  linkedin: "bg-sky-100 text-sky-600",
};

const CATEGORY_BADGE: Record<TemplateCategory, { label: string; className: string }> = {
  job_search: {
    label: "JOB SEARCH",
    className: "bg-violet-100 text-violet-700 border-violet-200",
  },
  sales: {
    label: "SALES",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepPreviewStrip({ steps }: { steps: TemplateStep[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <span
            className={`inline-flex items-center justify-center h-6 w-6 rounded ${STEP_TYPE_COLORS[step.stepType]}`}
          >
            {STEP_TYPE_ICONS[step.stepType]}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

function PreviewModal({
  template,
  isOpen,
  onClose,
  onUse,
}: {
  template: SequenceTemplate;
  isOpen: boolean;
  onClose: () => void;
  onUse: () => void;
}) {
  const badge = CATEGORY_BADGE[template.category];
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <DialogTitle>{template.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {template.steps.map((step, index) => {
            const stepConfig = STEP_TYPE_COLORS[step.stepType];
            return (
              <div key={index} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded shrink-0 ${stepConfig}`}
                  >
                    {STEP_TYPE_ICONS[step.stepType]}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    Step {step.order}
                    {index > 0 && step.delay_days > 0
                      ? ` · Day +${step.delay_days}`
                      : index === 0
                      ? " · Immediate"
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{step.stepType}</span>
                </div>
                {step.stepType !== "wait" && step.subject && (
                  <p className="text-xs font-medium text-foreground">{step.subject}</p>
                )}
                {step.body && step.stepType !== "wait" && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {step.body}
                  </p>
                )}
                {step.stepType === "wait" && (
                  <p className="text-xs text-amber-600">
                    Wait {step.delay_days} day{step.delay_days !== 1 ? "s" : ""} before next step
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onUse}>
            Use This Template
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  onPreview,
  onUse,
}: {
  template: SequenceTemplate;
  onPreview: () => void;
  onUse: () => void;
}) {
  const badge = CATEGORY_BADGE[template.category];
  const days = estimateDays(template.steps);

  return (
    <div className="border rounded-xl bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Badge */}
      <Badge
        variant="outline"
        className={`self-start text-[10px] font-bold tracking-wider px-2 py-0.5 ${badge.className}`}
      >
        {badge.label}
      </Badge>

      {/* Title + description */}
      <div>
        <h3 className="text-sm font-semibold leading-snug">{template.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {template.description}
        </p>
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground">
        {template.steps.length} steps · ~{days} days
      </p>

      {/* Preview strip */}
      <StepPreviewStrip steps={template.steps} />

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Preview
        </Button>
        <Button size="sm" className="flex-1" onClick={onUse}>
          Use Template
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface SequenceTemplateGalleryProps {
  onSelectTemplate: (name: string, steps: SequenceStep[]) => void;
  onBlankCanvas: () => void;
}

export function SequenceTemplateGallery({
  onSelectTemplate,
  onBlankCanvas,
}: SequenceTemplateGalleryProps) {
  const { isJobSeeker } = usePersona();
  const [activeTab, setActiveTab] = useState<FilterTab>(
    isJobSeeker ? "job_search" : "sales"
  );
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<SequenceTemplate | null>(null);

  const filtered = useMemo(() => {
    return BUILT_IN_TEMPLATES.filter((t) => {
      const matchesTab = activeTab === "all" || t.category === activeTab;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, search]);

  const handleUse = (template: SequenceTemplate) => {
    const steps = templateToSequenceSteps(template.steps);
    onSelectTemplate(template.name, steps);
  };

  const TABS: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "job_search", label: "Job Search" },
    { value: "sales", label: "Sales" },
  ];

  return (
    <div className="space-y-6">
      {/* Page title area */}
      <div>
        <h2 className="text-xl font-semibold">Start from a template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a pre-built sequence or build your own from scratch.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm font-medium">No templates match your search</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try a different filter or search term
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setPreviewTemplate(template)}
              onUse={() => handleUse(template)}
            />
          ))}
        </div>
      )}

      {/* Blank canvas option */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground shrink-0">
          or start from scratch
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBlankCanvas} className="gap-2">
          <Plus className="h-4 w-4" />
          Build Custom Sequence
        </Button>
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          isOpen={Boolean(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          onUse={() => {
            handleUse(previewTemplate);
            setPreviewTemplate(null);
          }}
        />
      )}
    </div>
  );
}
