"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { TopSequence } from "@/lib/hooks/useSequences";

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
  onViewAllContacts,
  onViewAllSequences,
}: QuickStatsProps) {
  return (
    <div className="space-y-4">
      {/* Recent Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Contacts</CardTitle>
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
          {recentContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No contacts yet
            </p>
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
            <CardTitle className="text-base">Top Sequences</CardTitle>
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
              <p className="text-sm text-muted-foreground">No sequences yet</p>
              <Link
                href="/dashboard/sequences"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                Create your first →
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
