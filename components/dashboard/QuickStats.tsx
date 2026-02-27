"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { TopSequence } from "@/lib/hooks/useSequences";
import { usePersona } from "@/context/PersonaContext";
import { getPersonaCopy } from "@/lib/persona-copy";

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  addedAt: Date;
}

interface QuickStatsProps {
  recentContacts: Contact[];
  topSequences: TopSequence[];
  loading?: boolean;
  contactsLoading?: boolean;
  contactsLive?: boolean;
  onViewAllContacts?: () => void;
  onViewAllSequences?: () => void;
}

/**
 * Render the QuickStats component.
 * @param {QuickStatsProps} props - Component props.
 * @returns {unknown} JSX output for QuickStats.
 * @example
 * <QuickStats />
 */
export function QuickStats({
  recentContacts,
  topSequences,
  loading = false,
  contactsLoading = false,
  contactsLive = false,
  onViewAllContacts,
  onViewAllSequences,
}: QuickStatsProps) {
  const { persona } = usePersona();
  const copy = getPersonaCopy(persona);

  return (
    <div className="space-y-4">
      {/* Recent Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Recent {copy.contacts}</CardTitle>
              {contactsLive ? (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  Live
                </Badge>
              ) : null}
            </div>
            {onViewAllContacts && (
              <Button variant="ghost" size="sm" onClick={onViewAllContacts} asChild>
                <Link href="/dashboard/contacts">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentContacts.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm font-medium text-slate-900">{copy.emptyContacts}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.extensionCTA}
              </p>
              <Link
                href="/dashboard/contacts"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                {copy.nextStepContactsCTA} &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentContacts.slice(0, 5).map((contact) => (
                <div key={contact.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {contact.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.company}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Sequences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Top {copy.sequences}</CardTitle>
            {onViewAllSequences && (
              <Button variant="ghost" size="sm" onClick={onViewAllSequences} asChild>
                <Link href="/dashboard/sequences">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            /* Skeleton rows — same pattern as the contacts skeleton */
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((item) => (
                <div key={item} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-muted flex-shrink-0" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                  <div className="h-1.5 w-full rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : topSequences.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-900">
                {copy.statsTemplatesEmptyMessage}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create reusable email templates to speed up outreach
              </p>
              <Link
                href="/dashboard/templates"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                {copy.nextStepTemplatesCTA} &rarr;
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {topSequences.map((sequence, index) => (
                <div key={sequence.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge
                        variant="outline"
                        className="w-6 h-6 rounded-full flex items-center justify-center p-0 flex-shrink-0"
                      >
                        {index + 1}
                      </Badge>
                      <p className="text-sm font-medium truncate">{sequence.name}</p>
                    </div>
                    {sequence.emailsSent === 0 ? (
                      <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                        —
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-sm flex-shrink-0">
                        {sequence.replyRate >= 30 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "font-medium",
                            sequence.replyRate >= 30
                              ? "text-green-600 dark:text-green-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {sequence.replyRate}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {sequence.emailsSent > 0 && (
                      <Progress value={sequence.replyRate} className="h-1.5" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {sequence.contactsEnrolled} contact
                      {sequence.contactsEnrolled !== 1 ? "s" : ""} enrolled
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

