"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { CsrfHiddenInput } from "@/components/CsrfHiddenInput";
import {
  Loader2, Check, Building2, Globe, Users, Server,
  ThumbsUp, ThumbsDown, Sparkles, AlertTriangle, RefreshCw,
} from "lucide-react";
import { VerificationStatusBadge, type EmailVerificationStatus } from "@/components/VerificationStatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  company: z.string().min(2, "Company name must be at least 2 characters"),
  role: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

/** Ordered discovery flow states */
type DiscoveryStep = "idle" | "generating" | "verifying" | "complete" | "error";

interface EmailPattern {
  email: string;
  pattern: string;
  confidence: number;
  verificationStatus?: EmailVerificationStatus;
  learned?: boolean;
  learnedData?: {
    attempts: number;
    successRate: number;
  };
}

interface EnrichmentResult {
  domain: string;
  size: string;
  emailProvider?: string;
}

interface VerificationResult {
  learningApplied?: boolean;
}

// ─── Progress indicator ───────────────────────────────────────────────────────

const STEPS: { key: DiscoveryStep; label: string }[] = [
  { key: "generating", label: "Generating patterns" },
  { key: "verifying",  label: "Verifying emails" },
  { key: "complete",   label: "Complete" },
];

function DiscoveryProgress({ step }: { step: DiscoveryStep }) {
  if (step === "idle" || step === "error") return null;

  const activeIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="flex items-center gap-2 py-2">
      {STEPS.map((s, i) => {
        const isDone    = i < activeIndex || step === "complete";
        const isActive  = s.key === step && step !== "complete";
        const isPending = i > activeIndex && step !== "complete";

        return (
          <div key={s.key} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`
              flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-xs font-semibold
              ${isDone   ? "bg-green-500 text-white" : ""}
              ${isActive ? "bg-primary text-primary-foreground" : ""}
              ${isPending ? "bg-muted text-muted-foreground" : ""}
            `}>
              {isDone
                ? <Check className="h-3 w-3" />
                : isActive
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <span>{i + 1}</span>
              }
            </div>
            <span className={`text-xs truncate ${
              isActive  ? "text-foreground font-medium" :
              isDone    ? "text-green-600" :
              "text-muted-foreground"
            }`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${isDone ? "bg-green-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Submit button label ──────────────────────────────────────────────────────

function SubmitButtonContent({ step }: { step: DiscoveryStep }) {
  if (step === "generating") {
    return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating email patterns...</>;
  }
  if (step === "verifying") {
    return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying top candidates...</>;
  }
  return <>Discover Email Patterns</>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailDiscoveryForm() {
  const [step, setStep]                     = useState<DiscoveryStep>("idle");
  const [enrichment, setEnrichment]         = useState<EnrichmentResult | null>(null);
  const [emails, setEmails]                 = useState<EmailPattern[]>([]);
  const [selectedEmail, setSelectedEmail]   = useState<string | null>(null);
  const [verification, setVerification]     = useState<VerificationResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [retryingEmails, setRetryingEmails] = useState<Set<string>>(new Set());

  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const isRunning = step === "generating" || step === "verifying";

  // Unverified emails after initial load — drives warning + retry button
  const unverifiedEmails = emails.filter(
    e => (e.verificationStatus === "unverified" || !e.verificationStatus) &&
         !retryingEmails.has(e.email)
  );
  const verifiedCount = emails.filter(e => e.verificationStatus === "verified").length;

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(data: FormData) {
    // Reset state
    setStep("generating");
    setEnrichment(null);
    setEmails([]);
    setSelectedEmail(null);
    setVerification(null);
    setFeedbackMessage("");
    setRetryingEmails(new Set());

    // Transition to "verifying" label after 2 s (matches typical pattern-gen time)
    stepTimerRef.current = setTimeout(() => setStep("verifying"), 2000);

    try {
      const response = await fetch("/api/v1/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          companyName: data.company,
          role: data.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Enrichment failed");
      }

      setEnrichment(result.enrichment);
      setEmails(result.emails);
      setVerification(result.verification);
      setStep("complete");

      const verified = (result.emails as EmailPattern[]).filter(
        e => e.verificationStatus === "verified"
      ).length;
      setFeedbackMessage(
        verified > 0
          ? `Found ${result.emails.length} patterns — ${verified} verified`
          : `Found ${result.emails.length} email patterns for ${data.company}`
      );
    } catch (error: unknown) {
      setStep("error");
      const errorMessage = error instanceof Error ? error.message : "Enrichment failed";
      setFeedbackMessage(errorMessage);
    } finally {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }
  }

  // ── Retry verification ──────────────────────────────────────────────────────

  async function handleRetryVerification() {
    const toRetry = emails.filter(
      e => e.verificationStatus === "unverified" || !e.verificationStatus
    );
    if (toRetry.length === 0) return;

    setRetryingEmails(new Set(toRetry.map(e => e.email)));
    setFeedbackMessage("");

    const results = await Promise.allSettled(
      toRetry.map(async (pattern) => {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pattern.email }),
        });
        if (!res.ok) throw new Error(`Verification failed for ${pattern.email}`);
        const data = await res.json() as { deliverable: boolean; smtpScore?: number };
        return { email: pattern.email, deliverable: data.deliverable };
      })
    );

    setEmails(prev => {
      const updated = prev.map(p => {
        const result = results.find(
          r => r.status === "fulfilled" && r.value.email === p.email
        );
        if (!result || result.status !== "fulfilled") return p;
        return {
          ...p,
          verificationStatus: (result.value.deliverable ? "verified" : "invalid") as EmailVerificationStatus,
          confidence: result.value.deliverable ? 95 : 5,
        };
      });
      return [...updated].sort((a, b) => b.confidence - a.confidence);
    });

    const failed = results.filter(r => r.status === "rejected").length;
    setFeedbackMessage(
      failed > 0
        ? `Verification complete — ${failed} email${failed > 1 ? "s" : ""} could not be verified`
        : "All emails verified successfully"
    );
    setRetryingEmails(new Set());
  }

  // ── Save lead ───────────────────────────────────────────────────────────────

  async function handleSaveLead() {
    if (!selectedEmail || !enrichment) return;

    const formData = form.getValues();
    const personName = `${formData.firstName} ${formData.lastName}`.trim();

    try {
      const response = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName,
          companyName: formData.company,
          emails: emails.map((pattern) => ({
            email: pattern.email,
            pattern: pattern.pattern,
            confidence: pattern.confidence,
          })),
          selectedEmail,
          status: "discovered",
        }),
      });

      if (!response.ok) throw new Error("Failed to save lead");

      setFeedbackMessage("Lead saved successfully!");
      window.dispatchEvent(new CustomEvent("lead-updated"));
    } catch {
      setFeedbackMessage("Could not save lead");
    }
  }

  // ── Feedback ────────────────────────────────────────────────────────────────

  async function handleFeedback(email: string, worked: boolean) {
    const pattern = emails.find(e => e.email === email);
    if (!pattern || !enrichment) return;

    try {
      await fetch("/api/v1/pattern-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          pattern: pattern.pattern,
          companyDomain: enrichment.domain,
          worked,
        }),
      });

      setFeedbackMessage(
        worked
          ? "Marked as Worked — thanks! This improves accuracy."
          : "Marked as Bounced — thanks for the feedback!"
      );
      setTimeout(() => setFeedbackMessage(""), 3000);
    } catch (error) {
      console.error("Failed to record feedback:", error);
      setFeedbackMessage("Could not record feedback. Please try again.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">

      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle>Discover Email Address</CardTitle>
          <CardDescription>
            Enter contact details to find their professional email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <CsrfHiddenInput />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input {...form.register("firstName")} placeholder="John" />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input {...form.register("lastName")} placeholder="Doe" />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label>Company *</Label>
              <Input {...form.register("company")} placeholder="Microsoft" />
              {form.formState.errors.company && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.company.message}
                </p>
              )}
            </div>

            <div>
              <Label>Role (Optional)</Label>
              <Input {...form.register("role")} placeholder="Senior Engineer" />
            </div>

            {/* Progress indicator — visible while running */}
            {isRunning && <DiscoveryProgress step={step} />}

            <Button type="submit" disabled={isRunning} className="w-full">
              <SubmitButtonContent step={step} />
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Free — no API costs
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Status / feedback message */}
      {feedbackMessage && (
        <Alert variant={step === "error" ? "destructive" : "default"}>
          <AlertDescription>{feedbackMessage}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {enrichment && (
        <>
          {/* Company info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Domain:</span>
                <span className="font-mono font-semibold">{enrichment.domain}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Company Size:</span>
                <Badge variant="secondary">{enrichment.size}</Badge>
              </div>
              {enrichment.emailProvider && (
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email Provider:</span>
                  <span>{enrichment.emailProvider}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email patterns */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>
                    Email Patterns ({emails.length})
                    {verifiedCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-green-600">
                        {verifiedCount} verified
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Select the most likely email address
                    {verification?.learningApplied && (
                      <Badge variant="outline" className="ml-2">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Learning Applied
                      </Badge>
                    )}
                  </CardDescription>
                </div>

                {/* Retry button — only when unverified emails remain and not currently retrying */}
                {unverifiedEmails.length > 0 && retryingEmails.size === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryVerification}
                    className="shrink-0 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Verify {unverifiedEmails.length} unverified
                  </Button>
                )}
                {retryingEmails.size > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verifying {retryingEmails.size}…
                  </span>
                )}
              </div>

              {/* Warning if unverified emails remain after load */}
              {step === "complete" && unverifiedEmails.length > 0 && retryingEmails.size === 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Some emails could not be verified — use the button above to retry
                </div>
              )}
            </CardHeader>

            <CardContent>
              <div className="space-y-2">
                {emails.map((pattern) => {
                  const isBeingRetried = retryingEmails.has(pattern.email);
                  const displayStatus: EmailVerificationStatus = isBeingRetried
                    ? "checking"
                    : (pattern.verificationStatus ?? "unverified");

                  return (
                    <div
                      key={pattern.email}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        selectedEmail === pattern.email
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedEmail(pattern.email)}
                        className="w-full text-left"
                        disabled={isBeingRetried}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {selectedEmail === pattern.email && !isBeingRetried && (
                              <Check className="h-5 w-5 text-primary shrink-0" />
                            )}
                            {isBeingRetried && (
                              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
                            )}
                            <span className="font-mono text-sm">{pattern.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={pattern.confidence >= 70 ? "default" : "secondary"}
                            >
                              {pattern.confidence}%
                            </Badge>
                            <VerificationStatusBadge status={displayStatus} />
                            {pattern.learned && (
                              <Badge variant="outline" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Learned
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Pattern: {pattern.pattern}</span>
                          {pattern.learned && pattern.learnedData && (
                            <span>
                              {pattern.learnedData.successRate.toFixed(0)}% success
                              ({pattern.learnedData.attempts} attempts)
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Feedback buttons */}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={isBeingRetried}
                          onClick={() => handleFeedback(pattern.email, true)}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Worked
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={isBeingRetried}
                          onClick={() => handleFeedback(pattern.email, false)}
                        >
                          <ThumbsDown className="h-3 w-3 mr-1" />
                          Bounced
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedEmail && (
                <Button onClick={handleSaveLead} className="w-full mt-4">
                  Save as Lead
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
