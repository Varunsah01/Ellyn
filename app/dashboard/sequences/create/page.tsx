"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sequence, SequenceStep } from "@/lib/types/sequence";
import { generateSequenceId, generateStepId } from "@/lib/utils/sequence-utils";

type WizardStep = "basic" | "steps" | "contacts" | "review";

interface SequenceFormData {
  name: string;
  description: string;
  goal: string;
  steps: SequenceStep[];
  selectedContacts: string[];
}

const wizardSteps: { id: WizardStep; label: string; number: number }[] = [
  { id: "basic", label: "Basic Info", number: 1 },
  { id: "steps", label: "Email Steps", number: 2 },
  { id: "contacts", label: "Select Contacts", number: 3 },
  { id: "review", label: "Review & Launch", number: 4 },
];

export default function CreateSequencePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("basic");
  const [formData, setFormData] = useState<SequenceFormData>({
    name: "",
    description: "",
    goal: "",
    steps: [],
    selectedContacts: [],
  });

  const currentStepIndex = wizardSteps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    if (currentStepIndex < wizardSteps.length - 1) {
      setCurrentStep(wizardSteps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(wizardSteps[currentStepIndex - 1].id);
    } else {
      router.push("/dashboard/sequences");
    }
  };

  const handleSaveDraft = () => {
    // TODO: Save to Supabase as draft
    console.log("Saving draft:", formData);
    router.push("/dashboard/sequences");
  };

  const handleLaunch = () => {
    // TODO: Save to Supabase and launch
    console.log("Launching sequence:", formData);
    router.push("/dashboard/sequences");
  };

  const isStepValid = () => {
    switch (currentStep) {
      case "basic":
        return formData.name.trim().length > 0;
      case "steps":
        return formData.steps.length > 0 && formData.steps.every(
          (step) => step.subject.trim().length > 0 && step.body.trim().length > 0
        );
      case "contacts":
        return formData.selectedContacts.length > 0;
      case "review":
        return true;
      default:
        return false;
    }
  };

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/sequences")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sequences
          </Button>
          <h1 className="text-3xl font-fraunces font-bold mb-2">Create New Sequence</h1>
          <p className="text-muted-foreground">
            Set up a multi-step email campaign to automate your outreach
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {wizardSteps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  {/* Step Circle */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                      currentStepIndex > index
                        ? "bg-primary text-primary-foreground"
                        : currentStepIndex === index
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {currentStepIndex > index ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  {/* Step Label */}
                  <span
                    className={cn(
                      "text-sm font-medium mt-2 hidden sm:block",
                      currentStepIndex >= index
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < wizardSteps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-all",
                      currentStepIndex > index ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {currentStep === "basic" && (
              <BasicInfoStep formData={formData} setFormData={setFormData} />
            )}
            {currentStep === "steps" && (
              <EmailStepsStep formData={formData} setFormData={setFormData} />
            )}
            {currentStep === "contacts" && (
              <SelectContactsStep formData={formData} setFormData={setFormData} />
            )}
            {currentStep === "review" && (
              <ReviewStep formData={formData} />
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStepIndex === 0 ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === "review" && (
              <Button variant="outline" onClick={handleSaveDraft}>
                Save as Draft
              </Button>
            )}

            {currentStep !== "review" ? (
              <Button onClick={handleNext} disabled={!isStepValid()}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleLaunch} disabled={!isStepValid()}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Sequence
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// Step 1: Basic Info
function BasicInfoStep({
  formData,
  setFormData,
}: {
  formData: SequenceFormData;
  setFormData: (data: SequenceFormData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name" className="text-base">
          Sequence Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="e.g., Software Engineer Outreach Q1 2024"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-2"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Give your sequence a clear, descriptive name
        </p>
      </div>

      <div>
        <Label htmlFor="description" className="text-base">
          Description
        </Label>
        <Textarea
          id="description"
          placeholder="Brief description of this sequence's purpose..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-2 min-h-[100px]"
        />
      </div>

      <div>
        <Label htmlFor="goal" className="text-base">
          Goal/Objective
        </Label>
        <Input
          id="goal"
          placeholder="e.g., Schedule 10 informational interviews"
          value={formData.goal}
          onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
          className="mt-2"
        />
        <p className="text-sm text-muted-foreground mt-1">
          What do you want to achieve with this sequence?
        </p>
      </div>
    </div>
  );
}

// Step 2: Email Steps
function EmailStepsStep({
  formData,
  setFormData,
}: {
  formData: SequenceFormData;
  setFormData: (data: SequenceFormData) => void;
}) {
  const addStep = () => {
    const newStep: SequenceStep = {
      id: generateStepId(),
      sequence_id: "",
      order: formData.steps.length + 1,
      delay_days: formData.steps.length === 0 ? 0 : 3,
      subject: "",
      body: "",
    };
    setFormData({ ...formData, steps: [...formData.steps, newStep] });
  };

  const updateStep = (index: number, updates: Partial<SequenceStep>) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setFormData({ ...formData, steps: newSteps });
  };

  const removeStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Update order numbers
    const reorderedSteps = newSteps.map((step, i) => ({ ...step, order: i + 1 }));
    setFormData({ ...formData, steps: reorderedSteps });
  };

  return (
    <div className="space-y-6">
      {formData.steps.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">No email steps yet</p>
          <Button onClick={addStep}>Add Your First Step</Button>
        </div>
      ) : (
        <>
          {formData.steps.map((step, index) => (
            <Card key={step.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Step {step.order} {index === 0 ? "(Initial Email)" : `(Day ${step.delay_days})`}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStep(index)}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {index > 0 && (
                  <div>
                    <Label>Delay (days after previous step)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={step.delay_days}
                      onChange={(e) =>
                        updateStep(index, { delay_days: parseInt(e.target.value) || 1 })
                      }
                      className="mt-2 w-32"
                    />
                  </div>
                )}

                <div>
                  <Label>
                    Subject Line <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., Quick question about {{company}}"
                    value={step.subject}
                    onChange={(e) => updateStep(index, { subject: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use variables like {"{{firstName}}"}, {"{{company}}"}, {"{{role}}"}
                  </p>
                </div>

                <div>
                  <Label>
                    Email Body <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder={`Hi {{firstName}},\n\nI noticed you work at {{company}} as a {{role}}...\n\nBest regards,\n{{userFirstName}}`}
                    value={step.body}
                    onChange={(e) => updateStep(index, { body: e.target.value })}
                    className="mt-2 min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available variables: {"{{firstName}}"}, {"{{lastName}}"}, {"{{company}}"}, {"{{role}}"}, {"{{userFirstName}}"}, {"{{userLastName}}"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={addStep} variant="outline" className="w-full">
            Add Follow-up Step
          </Button>
        </>
      )}
    </div>
  );
}

// Step 3: Select Contacts
function SelectContactsStep({
  formData,
  setFormData,
}: {
  formData: SequenceFormData;
  setFormData: (data: SequenceFormData) => void;
}) {
  // Mock contacts for now
  const mockContacts = [
    { id: "1", name: "John Smith", email: "john.smith@google.com", company: "Google" },
    { id: "2", name: "Sarah Johnson", email: "sarah.j@meta.com", company: "Meta" },
    { id: "3", name: "Michael Chen", email: "m.chen@microsoft.com", company: "Microsoft" },
  ];

  const toggleContact = (contactId: string) => {
    if (formData.selectedContacts.includes(contactId)) {
      setFormData({
        ...formData,
        selectedContacts: formData.selectedContacts.filter((id) => id !== contactId),
      });
    } else {
      setFormData({
        ...formData,
        selectedContacts: [...formData.selectedContacts, contactId],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Contacts</h3>
        <p className="text-sm text-muted-foreground">
          Choose which contacts to enroll in this sequence
        </p>
      </div>

      <div className="space-y-3">
        {mockContacts.map((contact) => (
          <Card
            key={contact.id}
            className={cn(
              "cursor-pointer transition-all",
              formData.selectedContacts.includes(contact.id)
                ? "border-primary bg-primary/5"
                : "hover:border-muted-foreground/50"
            )}
            onClick={() => toggleContact(contact.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                  <p className="text-xs text-muted-foreground">{contact.company}</p>
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center",
                    formData.selectedContacts.includes(contact.id)
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {formData.selectedContacts.includes(contact.id) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <p className="text-sm font-medium">
          {formData.selectedContacts.length} contact{formData.selectedContacts.length !== 1 ? "s" : ""} selected
        </p>
      </div>
    </div>
  );
}

// Step 4: Review & Launch
function ReviewStep({ formData }: { formData: SequenceFormData }) {
  const totalDays = formData.steps.reduce((sum, step) => sum + step.delay_days, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review Your Sequence</h3>
        <p className="text-sm text-muted-foreground">
          Double-check everything before launching
        </p>
      </div>

      {/* Basic Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium">Name:</span>
            <p className="text-sm text-muted-foreground">{formData.name}</p>
          </div>
          {formData.description && (
            <div>
              <span className="text-sm font-medium">Description:</span>
              <p className="text-sm text-muted-foreground">{formData.description}</p>
            </div>
          )}
          {formData.goal && (
            <div>
              <span className="text-sm font-medium">Goal:</span>
              <p className="text-sm text-muted-foreground">{formData.goal}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Steps ({formData.steps.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.steps.map((step, index) => (
            <div key={step.id} className="pb-4 border-b last:border-0 last:pb-0">
              <p className="text-sm font-medium mb-1">
                Step {step.order}: {index === 0 ? "Immediate" : `Day ${step.delay_days}`}
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Subject: {step.subject}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {step.body}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contacts Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Selected Contacts ({formData.selectedContacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formData.selectedContacts.length} contact{formData.selectedContacts.length !== 1 ? "s" : ""} will be enrolled in this sequence
          </p>
        </CardContent>
      </Card>

      {/* Estimated Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This sequence will run for approximately {totalDays} days from start to finish
          </p>
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
          Important: Once launched, emails will be sent according to the schedule. Make sure all information is correct.
        </p>
      </div>
    </div>
  );
}
