"use client";

import Link from "next/link";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useSubscription } from "@/context/SubscriptionContext";
import { showToast } from "@/lib/toast";
import { TemplatesGridSection } from "@/components/templates-dashboard/TemplatesGridSection";
import { useTemplateData } from "@/components/templates-dashboard/useTemplateData";
import {
  TONE_OPTIONS,
  TemplateRecord,
  TemplateTone,
  normalizeTone,
  toToneLabel,
} from "@/components/templates-dashboard/types";

export default function TemplatesPage() {
  const { planType, aiDraftUsed, aiDraftLimit, refresh: refreshSubscription } = useSubscription();

  const { templates, setTemplates, isLoading, fetchTemplates } = useTemplateData();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null);
  const [editForm, setEditForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [enhanceInstructions, setEnhanceInstructions] = useState("Make this more concise and compelling.");
  const [isEnhancingDraft, setIsEnhancingDraft] = useState(false);
  const [toneTarget, setToneTarget] = useState<TemplateTone>("professional");
  const [isChangingTone, setIsChangingTone] = useState(false);

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>(EMPTY_GENERATE_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [generatedTemplateName, setGeneratedTemplateName] = useState("AI Generated Template");
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);

  const [templateToDelete, setTemplateToDelete] = useState<TemplateRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [quotaPromptState, setQuotaPromptState] = useState<QuotaPromptState>({
    feature: "ai_draft_generation",
    used: 0,
    limit: 0,
  });

  const isPaidPlan = planType === "starter" || planType === "pro";
  const aiCreditsRemaining = Math.max(0, aiDraftLimit - aiDraftUsed);


  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (form: TemplateFormState, options?: { aiGenerated?: boolean }) => {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          subject: form.subject.trim(),
          body: form.body.trim(),
          tone: form.tone,
          is_ai_generated: Boolean(options?.aiGenerated),
        }),
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to save template"));
      }

      await fetchTemplates();
    },
    [fetchTemplates]
  );

  const handleQuotaExceeded = useCallback(
    async (payload: unknown) => {
      const raw = payload as { feature?: unknown; used?: unknown; limit?: unknown };

      setQuotaPromptState({
        feature: typeof raw.feature === "string" ? raw.feature : "ai_draft_generation",
        used: Number(raw.used ?? aiDraftUsed),
        limit: Number(raw.limit ?? aiDraftLimit),
      });

      setUpgradePromptOpen(true);
      await refreshSubscription();
    },
    [aiDraftLimit, aiDraftUsed, refreshSubscription]
  );

  const openGenerateModal = useCallback(() => {
    if (!isPaidPlan) {
      setQuotaPromptState({
        feature: "ai_draft_generation",
        used: aiDraftUsed,
        limit: aiDraftLimit,
      });
      setUpgradePromptOpen(true);
      return;
    }

    setIsGenerateOpen(true);
  }, [aiDraftLimit, aiDraftUsed, isPaidPlan]);

  const openEditModal = (template: TemplateRecord) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      tone: normalizeTone(template.tone),
    });
    setToneTarget(normalizeTone(template.tone));
    setEnhanceInstructions("Make this more concise and compelling.");
  };

  const copyTemplate = async (template: TemplateRecord) => {
    const text = `Subject: ${template.subject}\n\n${template.body}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast.success("Template copied to clipboard");
    } catch {
      showToast.error("Unable to copy template");
    }
  };

  const headerActions = useMemo(
    () => (
      <>
        <Button type="button" variant="outline" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
        <Button type="button" onClick={openGenerateModal}>
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </Button>
      </>
    ),
    [openGenerateModal]
  );

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.subject.trim() || !createForm.body.trim()) {
      showToast.error("Name, subject, and body are required");
      return;
    }

    setIsSavingCreate(true);
    try {
      await createTemplate(createForm);
      showToast.success("Template created");
      setIsCreateOpen(false);
      setCreateForm(EMPTY_TEMPLATE_FORM);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to create template");
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTemplate) return;

    if (!editForm.name.trim() || !editForm.subject.trim() || !editForm.body.trim()) {
      showToast.error("Name, subject, and body are required");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/email-templates/${editingTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          subject: editForm.subject.trim(),
          body: editForm.body.trim(),
          tone: editForm.tone,
        }),
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to update template"));
      }

      await fetchTemplates();
      setEditingTemplate(null);
      showToast.success("Template updated");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to update template");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEnhanceDraft = async () => {
    if (!editingTemplate) return;
    if (!editForm.subject.trim() || !editForm.body.trim()) {
      showToast.error("Subject and body are required before enhancing");
      return;
    }

    setIsEnhancingDraft(true);

    try {
      const response = await fetch("/api/ai/enhance-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editForm.subject,
          body: editForm.body,
          instructions: enhanceInstructions.trim() || "Improve clarity and actionability.",
        }),
      });

      const payload = await parseJson(response);

      if (response.status === 402) {
        await handleQuotaExceeded(payload);
        return;
      }

      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to enhance draft"));
      }

      const output = payload as { subject?: unknown; body?: unknown };
      setEditForm((prev) => ({
        ...prev,
        subject: typeof output.subject === "string" ? output.subject : prev.subject,
        body: typeof output.body === "string" ? output.body : prev.body,
      }));

      showToast.success("Draft enhanced");
      await refreshSubscription();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to enhance draft");
    } finally {
      setIsEnhancingDraft(false);
    }
  };

  const handleChangeTone = async () => {
    if (!editingTemplate) return;
    if (!editForm.subject.trim() || !editForm.body.trim()) {
      showToast.error("Subject and body are required before changing tone");
      return;
    }

    setIsChangingTone(true);

    try {
      const response = await fetch("/api/ai/customize-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editForm.subject,
          body: editForm.body,
          tone: toneTarget,
        }),
      });

      const payload = await parseJson(response);

      if (response.status === 402) {
        await handleQuotaExceeded(payload);
        return;
      }

      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to change tone"));
      }

      const output = payload as { subject?: unknown; body?: unknown };
      setEditForm((prev) => ({
        ...prev,
        tone: toneTarget,
        subject: typeof output.subject === "string" ? output.subject : prev.subject,
        body: typeof output.body === "string" ? output.body : prev.body,
      }));

      showToast.success("Tone updated");
      await refreshSubscription();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to change tone");
    } finally {
      setIsChangingTone(false);
    }
  };

  const handleGenerateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!generateForm.purpose.trim() || !generateForm.senderName.trim() || !generateForm.recipientRole.trim()) {
      showToast.error("Purpose, your name, and recipient role are required");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            senderName: generateForm.senderName.trim(),
            recipientRole: generateForm.recipientRole.trim(),
            purpose: generateForm.purpose.trim(),
            tone: generateForm.tone,
          },
        }),
      });

      const payload = await parseJson(response);

      if (response.status === 402) {
        await handleQuotaExceeded(payload);
        return;
      }

      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to generate template"));
      }

      const output = payload as { subject?: unknown; body?: unknown; tone?: unknown };

      setGeneratedTemplate({
        subject: typeof output.subject === "string" ? output.subject : "Quick introduction",
        body:
          typeof output.body === "string" && output.body.trim()
            ? output.body
            : "Hi there,\n\nI wanted to reach out.\n\nBest regards,",
        tone: normalizeTone(output.tone ?? generateForm.tone),
      });

      showToast.success("Template generated");
      await refreshSubscription();
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to generate template");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedTemplate = async () => {
    if (!generatedTemplate) return;

    const form: TemplateFormState = {
      name: generatedTemplateName.trim() || "AI Generated Template",
      subject: generatedTemplate.subject.trim(),
      body: generatedTemplate.body.trim(),
      tone: generatedTemplate.tone,
    };

    if (!form.subject || !form.body) {
      showToast.error("Generated content is incomplete");
      return;
    }

    setIsSavingGenerated(true);

    try {
      await createTemplate(form, { aiGenerated: true });
      showToast.success("Template saved");
      setIsGenerateOpen(false);
      setGenerateForm(EMPTY_GENERATE_FORM);
      setGeneratedTemplate(null);
      setGeneratedTemplateName("AI Generated Template");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSavingGenerated(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/email-templates/${templateToDelete.id}`, {
        method: "DELETE",
      });

      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload, "Failed to delete template"));
      }

      await fetchTemplates();
      setTemplateToDelete(null);
      showToast.success("Template deleted");
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <PageHeader
        title="Templates"
        description="Create reusable outreach templates and improve them with AI."
        actions={headerActions}
      />

      <div className="mb-6 rounded-lg border border-[#E6E4F2] bg-white p-4">
        {isPaidPlan ? (
          <p className="text-sm text-[#2D2B55]">
            <span className="font-semibold">AI credits remaining:</span> {aiCreditsRemaining} / {aiDraftLimit}
          </p>
        ) : (
          <p className="text-sm text-[#2D2B55]">
            AI generation is available on Starter and Pro plans. Upgrade to unlock template generation,
            tone customization, and draft enhancement.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-[#E6E4F2] bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl bg-white p-4">
          <EmptyState
            icon={<Sparkles className="h-7 w-7 text-[#5C5887]" />}
            title="No templates yet"
            description="No templates yet. Create your first template or generate one with AI."
            action={{
              label: "Create Template",
              onClick: () => setIsCreateOpen(true),
            }}
          />
          <div className="mt-3 flex items-center justify-center">
            <Button type="button" variant="outline" onClick={openGenerateModal}>
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="border-[#E6E4F2] bg-white">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-1 text-base text-[#2D2B55]">{template.name}</CardTitle>
                  <Badge className={toneBadgeClassName(template.tone)}>{toToneLabel(template.tone)}</Badge>
                </div>
                <CardDescription className="line-clamp-2 text-sm text-slate-600">
                  {template.subject || "No subject"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-5 min-h-[96px] whitespace-pre-wrap text-sm text-slate-700">
                  {template.body || "No body content"}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditModal(template)}>
                    Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyTemplate(template)}>
                    <Copy className="h-4 w-4" />
                    Use
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setTemplateToDelete(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>

                <p className="text-xs text-slate-500">Created {formatDate(template.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open: boolean) => {
          setIsCreateOpen(open);
          if (!open) {
            setCreateForm(EMPTY_TEMPLATE_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>Create a reusable template for outreach.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-subject">Subject</Label>
              <Input
                id="create-subject"
                value={createForm.subject}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, subject: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-body">Body</Label>
              <Textarea
                id="create-body"
                rows={8}
                value={createForm.body}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, body: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select
                value={createForm.tone}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, tone: normalizeTone(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {toToneLabel(tone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCreate}>
                {isSavingCreate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Template"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingTemplate)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEditingTemplate(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update content and apply AI improvements.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleEditSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input
                id="edit-subject"
                value={editForm.subject}
                onChange={(event) => setEditForm((prev) => ({ ...prev, subject: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-body">Body</Label>
              <Textarea
                id="edit-body"
                rows={10}
                value={editForm.body}
                onChange={(event) => setEditForm((prev) => ({ ...prev, body: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select
                value={editForm.tone}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, tone: normalizeTone(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {toToneLabel(tone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-[#2D2B55]">AI Tools</p>
                <p className="text-xs text-slate-600">Use your AI credits to improve this draft.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enhance-instructions">Enhance Instructions</Label>
                <Input
                  id="enhance-instructions"
                  value={enhanceInstructions}
                  onChange={(event) => setEnhanceInstructions(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isEnhancingDraft || isChangingTone}
                  onClick={() => void handleEnhanceDraft()}
                >
                  {isEnhancingDraft ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AI Enhance
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Change Tone</Label>
                  <Select value={toneTarget} onValueChange={(value) => setToneTarget(normalizeTone(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {toToneLabel(tone)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isChangingTone || isEnhancingDraft}
                  onClick={() => void handleChangeTone()}
                >
                  {isChangingTone ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Change Tone
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGenerateOpen}
        onOpenChange={(open: boolean) => {
          setIsGenerateOpen(open);
          if (!open) {
            setGenerateForm(EMPTY_GENERATE_FORM);
            setGeneratedTemplate(null);
            setGeneratedTemplateName("AI Generated Template");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate with AI</DialogTitle>
            <DialogDescription>Describe your outreach goal and let AI draft a template.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleGenerateSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="generate-purpose">Purpose</Label>
              <Textarea
                id="generate-purpose"
                rows={4}
                placeholder="Cold outreach to a hiring manager at Google"
                value={generateForm.purpose}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, purpose: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="generate-sender">Your Name</Label>
                <Input
                  id="generate-sender"
                  value={generateForm.senderName}
                  onChange={(event) => setGenerateForm((prev) => ({ ...prev, senderName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="generate-recipient-role">Recipient Role</Label>
                <Input
                  id="generate-recipient-role"
                  value={generateForm.recipientRole}
                  onChange={(event) =>
                    setGenerateForm((prev) => ({ ...prev, recipientRole: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select
                value={generateForm.tone}
                onValueChange={(value) => setGenerateForm((prev) => ({ ...prev, tone: normalizeTone(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {toToneLabel(tone)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </form>

          {generatedTemplate ? (
            <div className="space-y-3 rounded-lg border border-[#E6E4F2] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#2D2B55]">Generated Result</p>
                <Badge className={toneBadgeClassName(generatedTemplate.tone)}>
                  {toToneLabel(generatedTemplate.tone)}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="generated-subject">Subject</Label>
                <Input
                  id="generated-subject"
                  value={generatedTemplate.subject}
                  onChange={(event) =>
                    setGeneratedTemplate((prev) => (prev ? { ...prev, subject: event.target.value } : prev))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="generated-body">Body</Label>
                <Textarea
                  id="generated-body"
                  rows={8}
                  value={generatedTemplate.body}
                  onChange={(event) =>
                    setGeneratedTemplate((prev) => (prev ? { ...prev, body: event.target.value } : prev))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="generated-name">Template Name</Label>
                <Input
                  id="generated-name"
                  value={generatedTemplateName}
                  onChange={(event) => setGeneratedTemplateName(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`Subject: ${generatedTemplate.subject}\n\n${generatedTemplate.body}`)
                      .then(() => showToast.success("Generated template copied"))
                      .catch(() => showToast.error("Unable to copy generated template"))
                  }
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button type="button" disabled={isSavingGenerated} onClick={() => void handleSaveGeneratedTemplate()}>
                  {isSavingGenerated ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Template"
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(templateToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                void handleDeleteTemplate();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradePrompt
        variant="modal"
        open={upgradePromptOpen}
        onDismiss={() => setUpgradePromptOpen(false)}
        feature={quotaPromptState.feature}
        used={quotaPromptState.used}
        limit={quotaPromptState.limit}
      />

      {!isPaidPlan ? (
        <p className="mt-6 text-center text-sm text-slate-600">
          Need AI templates?{" "}
          <Link href="/dashboard/upgrade" className="font-medium text-[#2D2B55] underline">
            Upgrade your plan
          </Link>
        </p>
      ) : null}
    </DashboardShell>
  );
}
