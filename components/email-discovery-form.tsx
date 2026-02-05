"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Mail,
  CheckCircle2,
  Copy,
  AlertCircle,
  ShieldCheck,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { getConfidenceBadgeVariant, getConfidenceColor } from "@/lib/email-patterns";
import {
  getVerificationLabel,
  getVerificationColor,
} from "@/lib/email-verification-ui";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
});

interface EmailResult {
  email: string;
  pattern: string;
  confidence: number;
  baseConfidence?: number;
  verified?: boolean;
  smtpStatus?: 'valid' | 'invalid' | 'unknown';
  verificationTime?: string;
  error?: string;
}

interface GenerateEmailsResponse {
  success: boolean;
  domain: string;
  emails: EmailResult[];
  message: string;
  error?: string;
}

interface VerifyEmailsResponse {
  success: boolean;
  domain: string;
  hasMX: boolean;
  emails: EmailResult[];
  verified: number;
  total: number;
  message: string;
}

export function EmailDiscoveryForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<EmailResult[] | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [hasMX, setHasMX] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setSelectedEmail(null);
    setVerificationError(null);
    setHasMX(null);

    try {
      // Step 1: Generate email patterns
      const response = await fetch("/api/generate-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data: GenerateEmailsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate email patterns");
      }

      setResults(data.emails);
      setDomain(data.domain);
      setIsLoading(false);

      // Step 2: Automatically verify emails
      await verifyEmails(data.emails, data.domain);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  }

  async function verifyEmails(emails: EmailResult[], domainToVerify: string) {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: emails.map(e => ({
            email: e.email,
            pattern: e.pattern,
            baseConfidence: e.confidence,
          })),
          domain: domainToVerify,
        }),
      });

      const data: VerifyEmailsResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to verify emails");
      }

      // Update results with verified emails
      setResults(data.emails);
      setHasMX(data.hasMX);
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError(
        err instanceof Error ? err.message : "Verification failed"
      );
    } finally {
      setIsVerifying(false);
    }
  }

  const handleRetryVerification = () => {
    if (results && domain) {
      verifyEmails(results, domain);
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  const handleSelectEmail = (email: string) => {
    setSelectedEmail(email);
  };

  const handleSaveLead = async () => {
    if (!selectedEmail || !results) {
      return;
    }

    setIsSavingLead(true);

    try {
      const formValues = form.getValues();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personName: `${formValues.firstName} ${formValues.lastName}`,
          companyName: formValues.companyName,
          emails: results,
          selectedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save lead");
      }

      setLeadSaved(true);
      setTimeout(() => {
        // Redirect to dashboard leads tab after 2 seconds
        window.location.href = "/dashboard?tab=leads";
      }, 2000);
    } catch (err) {
      console.error("Error saving lead:", err);
      alert(err instanceof Error ? err.message : "Failed to save lead");
    } finally {
      setIsSavingLead(false);
    }
  };

  const getVerificationIcon = (smtpStatus?: string) => {
    switch (smtpStatus) {
      case 'valid':
        return <ShieldCheck className="h-4 w-4 text-green-600" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'unknown':
        return <HelpCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full max-w-md mx-auto">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} className="h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} className="h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc" {...field} className="h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base"
            disabled={isLoading || isVerifying}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Discover Emails
              </>
            )}
          </Button>
        </form>
      </Form>

      {/* Verification Progress */}
      {isVerifying && (
        <Card className="mt-6 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-600">
                  Verifying {results?.length || 0} emails...
                </p>
                <p className="text-sm text-muted-foreground">
                  Checking MX records and performing SMTP verification
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="mt-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Error with Retry */}
      {verificationError && (
        <Card className="mt-6 border-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{verificationError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryVerification}
                disabled={isVerifying}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Display */}
      {results && results.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-semibold">
              Found {results.length} Email Possibilities
            </h3>
            {domain && (
              <p className="text-sm text-muted-foreground mt-1">
                Domain: <span className="font-mono font-medium">{domain}</span>
                {hasMX !== null && (
                  <span className="ml-2">
                    {hasMX ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        MX Records Found
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600">
                        <XCircle className="mr-1 h-3 w-3" />
                        No MX Records
                      </Badge>
                    )}
                  </span>
                )}
              </p>
            )}
            {!isVerifying && results.some(r => r.verified !== undefined) && (
              <p className="text-sm text-muted-foreground mt-1">
                {results.filter(r => r.verified).length} verified,{" "}
                {results.filter(r => r.smtpStatus === 'invalid').length} invalid,{" "}
                {results.filter(r => r.smtpStatus === 'unknown').length} unknown
              </p>
            )}
          </div>

          {/* Verification Details */}
          {results.some(r => r.smtpStatus !== undefined) && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVerificationDetails(!showVerificationDetails)}
              >
                {showVerificationDetails ? (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Hide Verification Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Show Verification Details
                  </>
                )}
              </Button>
            </div>
          )}

          {showVerificationDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verification Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>MX Records:</span>
                  <span className="font-medium">
                    {hasMX ? (
                      <span className="text-green-600">✓ Found</span>
                    ) : (
                      <span className="text-red-600">✗ Not Found</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>SMTP Verification:</span>
                  <span className="font-medium">
                    {isVerifying ? "In Progress..." : "Completed"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Patterns Generated:</span>
                  <span className="font-medium">{results.length}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((result, index) => (
              <Card
                key={index}
                className={`transition-all hover:shadow-lg ${
                  selectedEmail === result.email
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                } ${result.verified ? 'border-green-500/50' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-mono break-all">
                          {result.email}
                        </CardTitle>
                        {result.smtpStatus && getVerificationIcon(result.smtpStatus)}
                      </div>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {result.pattern}
                        </Badge>
                        {result.smtpStatus && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${getVerificationColor(result.smtpStatus)}`}
                          >
                            {getVerificationLabel(result.smtpStatus)}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={getConfidenceBadgeVariant(result.confidence)}
                      className={getConfidenceColor(result.confidence)}
                    >
                      {result.confidence}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopyEmail(result.email)}
                    >
                      {copiedEmail === result.email ? (
                        <>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant={selectedEmail === result.email ? "default" : "secondary"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSelectEmail(result.email)}
                      disabled={result.smtpStatus === 'invalid'}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      {selectedEmail === result.email ? "Selected" : "Select"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save Lead Success Message */}
          {leadSaved && (
            <Card className="border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-medium">
                    Lead saved successfully! Redirecting to dashboard...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-center gap-3">
            {selectedEmail && !leadSaved && (
              <Button
                onClick={handleSaveLead}
                disabled={isSavingLead}
                size="lg"
              >
                {isSavingLead ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Save Lead
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setResults(null);
                setDomain(null);
                setHasMX(null);
                setSelectedEmail(null);
                setVerificationError(null);
                setLeadSaved(false);
                form.reset();
              }}
              disabled={isSavingLead}
            >
              Search Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
