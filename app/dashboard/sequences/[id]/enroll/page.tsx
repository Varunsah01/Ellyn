"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  Search,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { showToast } from "@/lib/toast";
import { useEmailIntegrations } from "@/hooks/useEmailIntegrations";

type WizardStep = 1 | 2 | 3;

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  confirmed_email: string | null;
  inferred_email: string | null;
  company: string | null;
  role: string | null;
  status: string | null;
};

type SequenceSummary = {
  id: string;
  name: string;
};

type SequenceStepRow = {
  id: string;
  step_order: number | null;
  step_type: "email" | "wait" | "condition" | "task" | null;
  subject: string | null;
  body: string | null;
};

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fullName(contact: ContactRow): string {
  const joined = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  return joined || "Unknown Contact";
}

function getContactEmail(contact: ContactRow): string {
  return contact.confirmed_email || contact.inferred_email || "";
}

function interpolatePreview(template: string, contact: ContactRow): string {
  const map: Record<string, string> = {
    firstname: contact.first_name ?? "there",
    first_name: contact.first_name ?? "there",
    lastname: contact.last_name ?? "",
    last_name: contact.last_name ?? "",
    company: contact.company ?? "your company",
    companyname: contact.company ?? "your company",
    company_name: contact.company ?? "your company",
    role: contact.role ?? "",
    email: getContactEmail(contact),
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key: string) => {
    const normalized = key.toLowerCase();
    const replacement = map[normalized];
    return typeof replacement === "string" ? replacement : token;
  });
}

const STEP_META: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "Select" },
  { step: 2, label: "Preview" },
  { step: 3, label: "Done" },
];

export default function EnrollContactsPage() {
  const params = useParams();
  const sequenceId = params.id as string;
  const { gmail, outlook } = useEmailIntegrations();
  const hasEmailConnected = gmail.connected || outlook.connected;
  const emailCheckLoading = gmail.loading || outlook.loading;

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sequence, setSequence] = useState<SequenceSummary | null>(null);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [enrolledCount, setEnrolledCount] = useState(0);

  const unwrapPayload = <T,>(payload: T | { data?: T }): T => {
    if (payload && typeof payload === "object" && "data" in payload && payload.data) {
      return payload.data;
    }
    return payload as T;
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);

      try {
        const [sequenceResponse, contactsResponse] = await Promise.all([
          fetch(`/api/v1/sequences/${sequenceId}`, { cache: "no-store" }),
          fetch(`/api/v1/contacts?limit=500&page=1&sortBy=created_at&sortDir=desc`, { cache: "no-store" }),
        ]);

        const rawSequencePayload = (await sequenceResponse.json().catch(() => ({}))) as {
          sequence?: SequenceSummary;
          steps?: SequenceStepRow[];
          error?: string;
          data?: {
            sequence?: SequenceSummary;
            steps?: SequenceStepRow[];
            error?: string;
          };
        };
        const sequencePayload = unwrapPayload(rawSequencePayload);

        if (!sequenceResponse.ok) {
          throw new Error(parseError(sequencePayload, "Failed to load sequence"));
        }

        const rawContactsPayload = (await contactsResponse.json().catch(() => ({}))) as {
          contacts?: ContactRow[];
          error?: string;
          data?: {
            contacts?: ContactRow[];
            error?: string;
          };
        };
        const contactsPayload = unwrapPayload(rawContactsPayload);

        if (!contactsResponse.ok) {
          throw new Error(parseError(contactsPayload, "Failed to load contacts"));
        }

        if (cancelled) return;

        setSequence(sequencePayload.sequence ?? null);

        const sortedSteps = Array.isArray(sequencePayload.steps)
          ? [...sequencePayload.steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
          : [];
        setSequenceSteps(sortedSteps);

        const contactRows = Array.isArray(contactsPayload.contacts) ? contactsPayload.contacts : [];
        setContacts(contactRows);
      } catch (error) {
        showToast.error(error instanceof Error ? error.message : "Failed to load enrollment data");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [sequenceId]);

  const contactsWithEmail = useMemo(
    () => contacts.filter((contact) => Boolean(getContactEmail(contact).trim())),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return contactsWithEmail;

    return contactsWithEmail.filter((contact) => {
      const name = fullName(contact).toLowerCase();
      const email = getContactEmail(contact).toLowerCase();
      const company = (contact.company ?? "").toLowerCase();

      return name.includes(query) || email.includes(query) || company.includes(query);
    });
  }, [contactsWithEmail, searchTerm]);

  const selectedContacts = useMemo(
    () => contactsWithEmail.filter((contact) => selectedContactIds.has(contact.id)),
    [contactsWithEmail, selectedContactIds]
  );

  const selectedCount = selectedContacts.length;

  useEffect(() => {
    setSelectedContactIds((prev) => {
      const validIds = new Set(contactsWithEmail.map((contact) => contact.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [contactsWithEmail]);

  const visibleContactIds = useMemo(() => filteredContacts.map((contact) => contact.id), [filteredContacts]);

  const allVisibleSelected =
    visibleContactIds.length > 0 && visibleContactIds.every((id) => selectedContactIds.has(id));
  const someVisibleSelected =
    visibleContactIds.some((id) => selectedContactIds.has(id)) && !allVisibleSelected;

  const primaryEmailStep = useMemo(
    () => sequenceSteps.find((step) => step.step_type === "email") ?? sequenceSteps[0] ?? null,
    [sequenceSteps]
  );

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleToggleSelectAllVisible = (checked: boolean | "indeterminate") => {
    if (checked !== true && checked !== false) return;

    setSelectedContactIds((prev) => {
      const next = new Set(prev);

      if (checked) {
        for (const id of visibleContactIds) {
          next.add(id);
        }
      } else {
        for (const id of visibleContactIds) {
          next.delete(id);
        }
      }

      return next;
    });
  };

  const handleSubmitEnrollment = async () => {
    if (selectedCount === 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: selectedContacts.map((contact) => contact.id),
          startDate,
        }),
      });

      const rawPayload = (await response.json().catch(() => ({}))) as {
        enrolled?: number;
        error?: string;
        data?: {
          enrolled?: number;
          error?: string;
        };
      };
      const payload = unwrapPayload(rawPayload);

      if (!response.ok) {
        throw new Error(parseError(payload, "Failed to enroll contacts"));
      }

      const successfulEnrollments = typeof payload.enrolled === "number" ? payload.enrolled : selectedCount;
      setEnrolledCount(successfulEnrollments);
      setWizardStep(3);
      showToast.success(`${successfulEnrollments} contact${successfulEnrollments === 1 ? "" : "s"} enrolled`);
    } catch (error) {
      showToast.error(error instanceof Error ? error.message : "Failed to enroll contacts");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Enroll Contacts"
          description={sequence ? `Add contacts to ${sequence.name}` : "Add contacts to this sequence"}
        />

        <div className="flex items-center gap-2">
          {STEP_META.map((entry, index) => {
            const isActive = wizardStep === entry.step;
            const isCompleted = wizardStep > entry.step;

            return (
              <div key={entry.step} className="flex items-center gap-2">
                {index > 0 && (
                  <div className={`h-px w-8 ${wizardStep > entry.step ? "bg-[#FF6B6B]" : "bg-[#E6E4F2]"}`} />
                )}
                <div
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? "border-[#FF6B6B] bg-[#FFF0F0] text-[#FF6B6B]"
                      : isCompleted
                        ? "border-[#FF6B6B] bg-[#FF6B6B] text-white"
                        : "border-[#E6E4F2] bg-white text-slate-500"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isActive
                        ? "bg-[#FF6B6B] text-white"
                        : isCompleted
                          ? "bg-white/20 text-white"
                          : "bg-[#F3F2FB] text-slate-600"
                    }`}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : entry.step}
                  </span>
                  {entry.label}
                </div>
              </div>
            );
          })}
        </div>

        {!emailCheckLoading && !hasEmailConnected && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Connect an Email Account to Enroll Contacts
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Bulk enrollment requires a connected Gmail or Outlook account so Ellyn can send emails on your behalf.
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/dashboard/settings">
                  <Mail className="mr-2 h-4 w-4" />
                  Connect
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#E6E4F2] bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-[#2D2B55]" />
          </div>
        ) : (
          <>
            {wizardStep === 1 && (
              <Card className="border-[#E6E4F2] bg-white">
                <CardHeader className="space-y-3">
                  <CardTitle>Select Contacts</CardTitle>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by name, email, or company"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-sm text-slate-600">{selectedCount} contacts selected</p>
                </CardHeader>
                <CardContent>
                  {filteredContacts.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#D9D6EE] bg-[#FAFAFA] p-8 text-center text-sm text-slate-600">
                      No contacts with email addresses match your search.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-[#E6E4F2]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#FAFAFA] text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-3">
                              <Checkbox
                                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                onCheckedChange={handleToggleSelectAllVisible}
                                aria-label="Select all visible contacts"
                              />
                            </th>
                            <th className="px-3 py-3">Name</th>
                            <th className="px-3 py-3">Email</th>
                            <th className="px-3 py-3">Company</th>
                            <th className="px-3 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0EEF8]">
                          {filteredContacts.map((contact) => (
                            <tr key={contact.id} className="hover:bg-[#FAFAFA]">
                              <td className="px-3 py-3">
                                <Checkbox
                                  checked={selectedContactIds.has(contact.id)}
                                  onCheckedChange={() => toggleContact(contact.id)}
                                  aria-label={`Select ${fullName(contact)}`}
                                />
                              </td>
                              <td className="px-3 py-3 font-medium text-[#2D2B55]">{fullName(contact)}</td>
                              <td className="px-3 py-3 text-slate-700">{getContactEmail(contact) || "-"}</td>
                              <td className="px-3 py-3 text-slate-700">{contact.company || "-"}</td>
                              <td className="px-3 py-3">
                                <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                                  {contact.status || "new"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setWizardStep(2)} disabled={selectedCount === 0}>
                      Next: Preview →
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {wizardStep === 2 && (
              <Card className="border-[#E6E4F2] bg-white">
                <CardHeader className="space-y-4">
                  <CardTitle>Preview & Confirm</CardTitle>
                  <p className="text-sm text-slate-600">
                    {selectedCount} contacts will be enrolled, starting {formatDisplayDate(startDate)}
                  </p>
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="start-date">Start date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedContacts.length === 0 ? (
                    <p className="text-sm text-slate-600">No contacts selected.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedContacts.map((contact) => {
                        const isExpanded = expandedContactId === contact.id;
                        const subjectTemplate = primaryEmailStep?.subject?.trim() || "(No subject)";
                        const bodyTemplate = primaryEmailStep?.body?.trim() || "No email body available.";
                        const previewSubject = interpolatePreview(subjectTemplate, contact);
                        const previewBody = interpolatePreview(bodyTemplate, contact);

                        return (
                          <div key={contact.id} className="rounded-md border border-[#E6E4F2]">
                            <button
                              type="button"
                              onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                              className="flex w-full items-center justify-between px-3 py-3 text-left"
                            >
                              <div>
                                <p className="text-sm font-medium text-[#2D2B55]">{fullName(contact)}</p>
                                <p className="text-xs text-slate-600">{getContactEmail(contact)}</p>
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="border-t border-[#E6E4F2] bg-[#FAFAFA] p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  First Email Preview
                                </p>
                                <p className="mt-2 text-sm font-medium text-[#2D2B55]">Subject: {previewSubject}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{previewBody}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                      ← Back
                    </Button>
                    <Button type="button" onClick={() => void handleSubmitEnrollment()} disabled={isSubmitting || selectedCount === 0 || !hasEmailConnected}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Enroll {selectedCount} Contact{selectedCount === 1 ? "" : "s"} →
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {wizardStep === 3 && (
              <Card className="border-[#E6E4F2] bg-white">
                <CardContent className="flex flex-col items-center gap-5 p-10 text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <span className="absolute h-20 w-20 animate-ping rounded-full bg-[#FF6B6B]/20" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#FF6B6B] text-white">
                      <Check className="h-8 w-8" />
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-semibold text-[#2D2B55]">Success</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      {enrolledCount} contacts enrolled successfully
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button asChild>
                      <Link href={`/dashboard/sequences/${sequenceId}`}>View Sequence</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/contacts">Go to Contacts</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
