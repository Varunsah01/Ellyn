"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  AtSign,
  Eye,
  Monitor,
  Smartphone,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { emailVariables, replaceVariables } from "@/lib/utils/email-variables";

interface EmailEditorProps {
  subject: string;
  body: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  className?: string;
}

export function EmailEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  className,
}: EmailEditorProps) {
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Mock contact data for preview
  const mockContactData = {
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    company: "Google",
    role: "Software Engineer",
    linkedinUrl: "https://linkedin.com/in/johndoe",
    userFirstName: "Sarah",
    userLastName: "Smith",
    userCompany: "TechCorp",
  };

  const insertVariable = (variableKey: string) => {
    // Insert at end of body for now (in a real implementation, you'd track cursor position)
    onBodyChange(body + `{{${variableKey}}}`);
  };

  const previewSubject = replaceVariables(subject, mockContactData);
  const previewBody = replaceVariables(body, mockContactData);

  // Simple spam score calculation (0-100)
  const calculateSpamScore = (): number => {
    let score = 0;
    const text = (subject + " " + body).toLowerCase();

    // Spam indicators
    if (text.includes("free")) score += 15;
    if (text.includes("click here")) score += 20;
    if (text.includes("urgent")) score += 10;
    if (text.includes("!!!")) score += 15;
    if (text.match(/\$/g)?.length > 2) score += 10;
    if (subject.length > 60) score += 10;
    if (text.includes("guarantee")) score += 10;
    if (body.length < 50) score += 15;

    return Math.min(score, 100);
  };

  const spamScore = calculateSpamScore();

  const getSpamScoreColor = (score: number) => {
    if (score < 30) return "text-green-500";
    if (score < 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getSpamScoreLabel = (score: number) => {
    if (score < 30) return "Low Risk";
    if (score < 60) return "Medium Risk";
    return "High Risk";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === "preview" && (
          <div className="flex items-center gap-2">
            <Button
              variant={previewDevice === "desktop" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewDevice("desktop")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewDevice === "mobile" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewDevice("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {viewMode === "edit" ? (
        <>
          {/* Subject Line */}
          <div>
            <Label htmlFor="subject">
              Subject Line <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="e.g., Quick question about {{company}}"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="mt-2"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {subject.length} characters {subject.length > 60 && "(aim for under 60)"}
              </p>
              <VariablePicker onSelect={insertVariable} target="subject" />
            </div>
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="body">
                Email Body <span className="text-destructive">*</span>
              </Label>
              <VariablePicker onSelect={insertVariable} target="body" />
            </div>
            <Textarea
              id="body"
              placeholder={`Hi {{firstName}},\n\nI noticed you work at {{company}} as a {{role}}. I'm reaching out because...\n\nBest regards,\n{{userFirstName}}`}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {body.length} characters • Use {"{{variableName}}"} for personalization
            </p>
          </div>

          {/* Spam Score */}
          <Card className="p-4 bg-muted">
            <div className="flex items-start gap-3">
              <AlertCircle className={cn("h-5 w-5 flex-shrink-0", getSpamScoreColor(spamScore))} />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Spam Score</span>
                  <span className={cn("text-sm font-bold", getSpamScoreColor(spamScore))}>
                    {spamScore}/100 - {getSpamScoreLabel(spamScore)}
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      spamScore < 30 ? "bg-green-500" : spamScore < 60 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${spamScore}%` }}
                  />
                </div>
                {spamScore >= 30 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Tips: Avoid words like "free", "urgent", "click here". Keep subject under 60 chars.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <EmailPreview
          subject={previewSubject}
          body={previewBody}
          device={previewDevice}
          contactName={mockContactData.fullName}
        />
      )}
    </div>
  );
}

interface VariablePickerProps {
  onSelect: (variableKey: string) => void;
  target: "subject" | "body";
}

function VariablePicker({ onSelect, target }: VariablePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <AtSign className="mr-2 h-4 w-4" />
          Insert Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Contact Variables
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {emailVariables
                .filter((v) => !v.key.startsWith("user"))
                .map((variable) => (
                  <Button
                    key={variable.key}
                    variant="outline"
                    size="sm"
                    onClick={() => onSelect(variable.key)}
                    className="justify-start text-xs h-8"
                    type="button"
                  >
                    {variable.label}
                  </Button>
                ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Your Info</h4>
            <div className="grid grid-cols-2 gap-2">
              {emailVariables
                .filter((v) => v.key.startsWith("user"))
                .map((variable) => (
                  <Button
                    key={variable.key}
                    variant="outline"
                    size="sm"
                    onClick={() => onSelect(variable.key)}
                    className="justify-start text-xs h-8"
                    type="button"
                  >
                    {variable.label}
                  </Button>
                ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Variables will be replaced with actual values when sending
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EmailPreviewProps {
  subject: string;
  body: string;
  device: "desktop" | "mobile";
  contactName: string;
}

function EmailPreview({ subject, body, device, contactName }: EmailPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Previewing as sent to {contactName}
        </p>
      </div>

      <Card
        className={cn(
          "transition-all",
          device === "mobile" ? "max-w-sm mx-auto" : "w-full"
        )}
      >
        <div className="border-b bg-muted/30 p-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-primary">
                  {contactName.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{contactName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  to: me
                </p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-base">{subject || "(No subject)"}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {body || "(No content)"}
            </pre>
          </div>
        </div>
      </Card>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          This is a preview with sample data. Actual emails will use real contact information.
        </p>
      </div>
    </div>
  );
}
