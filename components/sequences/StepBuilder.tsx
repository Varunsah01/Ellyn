"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  GripVertical,
  Plus,
  Edit,
  Trash,
  Mail,
  Clock,
  Eye,
} from "lucide-react";
import { SequenceStep } from "@/lib/types/sequence";
import { generateStepId } from "@/lib/utils/sequence-utils";
import { Reorder } from "framer-motion";

interface StepBuilderProps {
  steps: SequenceStep[];
  onChange: (steps: SequenceStep[]) => void;
  templates?: Array<{ id: string; name: string; subject: string; body: string }>;
}

/**
 * Render the StepBuilder component.
 * @param {StepBuilderProps} props - Component props.
 * @returns {unknown} JSX output for StepBuilder.
 * @example
 * <StepBuilder />
 */
export function StepBuilder({ steps, onChange, templates = [] }: StepBuilderProps) {
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const addStep = () => {
    const newStep: SequenceStep = {
      id: generateStepId(),
      sequence_id: "",
      order: steps.length + 1,
      delay_days: steps.length === 0 ? 0 : 3,
      subject: "",
      body: "",
      status: "draft",
      stop_on_reply: true,
      stop_on_bounce: true,
    };
    setEditingStep(newStep);
    setIsDialogOpen(true);
  };

  const editStep = (step: SequenceStep) => {
    setEditingStep(step);
    setIsDialogOpen(true);
  };

  const saveStep = (step: SequenceStep) => {
    if (steps.find((s) => s.id === step.id)) {
      // Update existing step
      onChange(steps.map((s) => (s.id === step.id ? step : s)));
    } else {
      // Add new step
      onChange([...steps, step]);
    }
    setIsDialogOpen(false);
    setEditingStep(null);
  };

  const deleteStep = (stepId: string) => {
    const newSteps = steps.filter((s) => s.id !== stepId);
    // Reorder remaining steps
    const reorderedSteps = newSteps.map((step, index) => ({
      ...step,
      order: index + 1,
    }));
    onChange(reorderedSteps);
  };

  const handleReorder = (newSteps: SequenceStep[]) => {
    // Update order numbers after drag
    const reorderedSteps = newSteps.map((step, index) => ({
      ...step,
      order: index + 1,
    }));
    onChange(reorderedSteps);
  };

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Email Steps Yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first email step to start building your sequence
        </p>
        <Button onClick={addStep}>
          <Plus className="mr-2 h-4 w-4" />
          Add First Step
        </Button>

        {isDialogOpen && editingStep && (
          <StepEditorDialog
            step={editingStep}
            isOpen={isDialogOpen}
            onClose={() => {
              setIsDialogOpen(false);
              setEditingStep(null);
            }}
            onSave={saveStep}
            templates={templates}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Reorder.Group
        axis="y"
        values={steps}
        onReorder={handleReorder}
        className="space-y-3"
      >
        {steps.map((step, index) => (
          <Reorder.Item key={step.id} value={step}>
            <StepCard
              step={step}
              index={index}
              onEdit={() => editStep(step)}
              onDelete={() => deleteStep(step.id)}
            />
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <Button onClick={addStep} variant="outline" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Follow-up Step
      </Button>

      {isDialogOpen && editingStep && (
        <StepEditorDialog
          step={editingStep}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingStep(null);
          }}
          onSave={saveStep}
          templates={templates}
        />
      )}
    </div>
  );
}

interface StepCardProps {
  step: SequenceStep;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function StepCard({ step, index, onEdit, onDelete }: StepCardProps) {
  return (
    <Card className="border-2 hover:border-primary/50 transition-all cursor-move">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                Step {step.order}
              </CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {index === 0 ? "Immediate" : `Day ${step.delay_days}`}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {step.subject || "No subject"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
              <span>Stops on reply: {step.stop_on_reply ? "Yes" : "No"}</span>
              <span>â€¢</span>
              <span>Stops on bounce: {step.stop_on_bounce ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap font-mono">
            {step.body || "No content"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StepEditorDialogProps {
  step: SequenceStep;
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: SequenceStep) => void;
  templates?: Array<{ id: string; name: string; subject: string; body: string }>;
}

function StepEditorDialog({
  step: initialStep,
  isOpen,
  onClose,
  onSave,
  templates = [],
}: StepEditorDialogProps) {
  const [step, setStep] = useState<SequenceStep>({
    ...initialStep,
    stop_on_reply: initialStep.stop_on_reply ?? true,
    stop_on_bounce: initialStep.stop_on_bounce ?? true,
  });
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = () => {
    if (step.subject.trim() && step.body.trim()) {
      onSave(step);
    }
  };

  const insertVariable = (variable: string) => {
    setStep({
      ...step,
      body: step.body + `{{${variable}}}`,
    });
  };

  const variables = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "company", label: "Company" },
    { key: "role", label: "Role" },
    { key: "userFirstName", label: "Your First Name" },
    { key: "userLastName", label: "Your Last Name" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialStep.id === step.id && initialStep.subject
              ? "Edit Email Step"
              : "Create Email Step"}
          </DialogTitle>
          <DialogDescription>
            Compose your email with personalization variables
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Delay */}
          {step.order > 1 && (
            <div>
              <Label>Delay (days after previous step)</Label>
              <Input
                type="number"
                min="1"
                value={step.delay_days}
                onChange={(e) =>
                  setStep({ ...step, delay_days: parseInt(e.target.value) || 1 })
                }
                className="mt-2 w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How many days to wait before sending this email
              </p>
            </div>
          )}

          {/* Template Picker */}
          {templates.length > 0 && (
            <div>
              <Label>Email template (optional)</Label>
              <Select
                value={step.template_id ?? "custom"}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setStep({ ...step, template_id: undefined });
                    return;
                  }
                  const selected = templates.find((t) => t.id === value);
                  if (selected) {
                    setStep({
                      ...step,
                      template_id: selected.id,
                      subject: selected.subject,
                      body: selected.body,
                    });
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom (no template)</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecting a template will replace the subject and body.
              </p>
            </div>
          )}

          {/* Subject Line */}
          <div>
            <Label>
              Subject Line <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g., Quick question about {{company}}"
              value={step.subject}
              onChange={(e) => setStep({ ...step, subject: e.target.value })}
              className="mt-2"
            />
          </div>

          {/* Variable Picker */}
          <div>
            <Label>Insert Variables</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {variables.map((v) => (
                <Button
                  key={v.key}
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(v.key)}
                  type="button"
                >
                  {v.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Click to insert personalization variables into your email
            </p>
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Email Body <span className="text-destructive">*</span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                type="button"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>

            {showPreview ? (
              <div className="border rounded-md p-4 bg-muted min-h-[300px]">
                <p className="text-sm font-medium mb-2">Subject: {step.subject}</p>
                <div className="text-sm whitespace-pre-wrap">
                  {step.body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                    const mockData: Record<string, string> = {
                      firstName: "John",
                      lastName: "Doe",
                      company: "Google",
                      role: "Software Engineer",
                      userFirstName: "Your Name",
                      userLastName: "Your Last",
                    };
                    return mockData[key] || `{{${key}}}`;
                  })}
                </div>
              </div>
            ) : (
              <Textarea
                placeholder={`Hi {{firstName}},\n\nI noticed you work at {{company}} as a {{role}}...\n\nBest regards,\n{{userFirstName}}`}
                value={step.body}
                onChange={(e) => setStep({ ...step, body: e.target.value })}
                className="mt-2 min-h-[300px] font-mono text-sm"
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Stop on reply</p>
                <p className="text-xs text-muted-foreground">
                  End the sequence once the contact replies.
                </p>
              </div>
              <Switch
                checked={step.stop_on_reply ?? true}
                onCheckedChange={(checked) =>
                  setStep({ ...step, stop_on_reply: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Stop on bounce</p>
                <p className="text-xs text-muted-foreground">
                  Pause the sequence if an email bounces.
                </p>
              </div>
              <Switch
                checked={step.stop_on_bounce ?? true}
                onCheckedChange={(checked) =>
                  setStep({ ...step, stop_on_bounce: checked })
                }
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!step.subject.trim() || !step.body.trim()}
            >
              Save Step
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
