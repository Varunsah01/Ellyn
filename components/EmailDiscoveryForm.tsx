"use client";

import { useState } from "react";
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
  CheckCircle2, ThumbsUp, ThumbsDown, Sparkles
} from "lucide-react";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  company: z.string().min(2, "Company name must be at least 2 characters"),
  role: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EmailPattern {
  email: string;
  pattern: string;
  confidence: number;
  learned?: boolean;
  learnedData?: {
    attempts: number;
    successRate: number;
  };
}

interface EnrichmentResult {
  domain: string;
  size: string;
  mxRecords: number;
  emailProvider?: string;
}

interface VerificationResult {
  mxVerified?: boolean;
  learningApplied?: boolean;
}

/**
 * Render the EmailDiscoveryForm component.
 * @returns {unknown} JSX output for EmailDiscoveryForm.
 * @example
 * <EmailDiscoveryForm />
 */
export function EmailDiscoveryForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(null);
  const [emails, setEmails] = useState<EmailPattern[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    setEnrichment(null);
    setEmails([]);
    setSelectedEmail(null);
    setVerification(null);
    setFeedbackMessage("");

    try {
      const response = await fetch("/api/v1/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          companyName: data.company,
          role: data.role
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Enrichment failed");
      }

      setEnrichment(result.enrichment);
      setEmails(result.emails);
      setVerification(result.verification);
      setFeedbackMessage(`✅ Found ${result.emails.length} email patterns for ${data.company}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Enrichment failed";
      setFeedbackMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

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
    } catch (error) {
      setFeedbackMessage("Could not save lead");
    }
  }
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
          worked
        })
      });

      setFeedbackMessage(
        worked
          ? "✅ Marked as Worked - Thanks! This helps improve our accuracy."
          : "❌ Marked as Bounced - Thanks for the feedback!"
      );

      // Reload patterns after feedback to reflect updated learning
      setTimeout(() => {
        setFeedbackMessage("");
      }, 3000);
    } catch (error) {
      console.error("Failed to record feedback:", error);
      setFeedbackMessage("⚠️ Could not record feedback. Please try again.");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Input Form */}
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

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discovering...
                </>
              ) : (
                "Discover Email Patterns"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              💯 Free - No API costs!
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Feedback Message */}
      {feedbackMessage && (
        <Alert>
          <AlertDescription>{feedbackMessage}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {enrichment && (
        <>
          {/* Company Info with MX Verification */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
                {verification?.mxVerified && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Email Server Verified
                  </Badge>
                )}
              </div>
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

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {enrichment.mxRecords} email server(s) found. This domain can receive emails.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Email Patterns with Learning Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Email Patterns ({emails.length})</CardTitle>
              <CardDescription>
                Select the most likely email address
                {verification?.learningApplied && (
                  <Badge variant="outline" className="ml-2">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Learning Applied
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {emails.map((pattern) => (
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
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {selectedEmail === pattern.email && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                          <span className="font-mono text-sm">{pattern.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={pattern.confidence >= 70 ? "default" : "secondary"}
                          >
                            {pattern.confidence}%
                          </Badge>
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

                    {/* Feedback Buttons */}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleFeedback(pattern.email, true)}
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Worked
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleFeedback(pattern.email, false)}
                      >
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Bounced
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedEmail && (
                <Button
                  onClick={handleSaveLead}
                  className="w-full mt-4"
                >
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


