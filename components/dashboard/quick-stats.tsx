"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  addedAt: Date;
}

interface Sequence {
  id: string;
  name: string;
  replyRate: number;
  contactsEnrolled: number;
}

interface QuickStatsProps {
  recentContacts: Contact[];
  topSequences: Sequence[];
  onViewAllContacts?: () => void;
  onViewAllSequences?: () => void;
  loading?: boolean;
}

export function QuickStats({
  recentContacts,
  topSequences,
  onViewAllContacts,
  onViewAllSequences,
  loading = false,
}: QuickStatsProps) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Sequences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-2 w-full rounded bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

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
          {topSequences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sequences yet
            </p>
          ) : (
            <div className="space-y-4">
              {topSequences.slice(0, 3).map((sequence, index) => (
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
                  </div>
                  <div className="space-y-1">
                    <Progress value={sequence.replyRate} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {sequence.contactsEnrolled} contacts enrolled
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips & Recommendations */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">💡 Quick Tip</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Your reply rate is above average! Keep personalizing your messages to
            maintain this momentum.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Best send time: Tuesdays at 10 AM
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
