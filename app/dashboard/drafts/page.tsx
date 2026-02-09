"use client";

import { useSequences } from "@/lib/hooks/useSequences";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyDrafts } from "@/components/empty-state";
import { Pencil, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function DraftsPage() {
  const { drafts, loading } = useSequences();
  const pendingDrafts = drafts.filter((d) => d.status === "draft");

  if (loading) {
    return (
      <DashboardShell loading={true}>
        <div />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Drafts"
        description="Works in progress. Pick up where you left off."
      />

      {pendingDrafts.length > 0 ? (
        <div className="grid gap-4">
          {pendingDrafts.map((draft) => (
            <Card key={draft.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground truncate">
                      {draft.subject || "(No Subject)"}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      to {draft.contacts?.full_name || "Unknown"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-1 mb-2 font-dm-sans">
                    {draft.body}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Edited {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <Link href={`/compose?draft=${draft.id}`}>
                  <Button variant="ghost" className="group-hover:bg-secondary">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyDrafts />
      )}
    </DashboardShell>
  );
}
