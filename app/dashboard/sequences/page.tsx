"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Rocket } from "lucide-react";
import { SequenceCard } from "@/components/sequences/sequence-card";
import { mockSequences } from "@/lib/data/mock-sequences";
import { Sequence } from "@/lib/types/sequence";
import { useRouter } from "next/navigation";

export default function SequencesPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState<Sequence[]>(mockSequences);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated");

  const filteredSequences = sequences.filter((seq) => {
    if (statusFilter === "all") return true;
    return seq.status === statusFilter;
  });

  const sortedSequences = [...filteredSequences].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "created") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // Default: updated
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handlePause = (id: string) => {
    setSequences(
      sequences.map((seq) =>
        seq.id === id ? { ...seq, status: "paused" as const } : seq
      )
    );
  };

  const handleResume = (id: string) => {
    setSequences(
      sequences.map((seq) =>
        seq.id === id ? { ...seq, status: "active" as const } : seq
      )
    );
  };

  const handleDuplicate = (id: string) => {
    const original = sequences.find((seq) => seq.id === id);
    if (original) {
      const duplicate: Sequence = {
        ...original,
        id: `seq_${Date.now()}`,
        name: `${original.name} (Copy)`,
        status: "draft",
        stats: {
          ...original.stats,
          totalContacts: 0,
          emailsSent: 0,
          opened: 0,
          replied: 0,
          bounced: 0,
          unsubscribed: 0,
          inProgress: 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSequences([...sequences, duplicate]);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to archive this sequence?")) {
      setSequences(sequences.filter((seq) => seq.id !== id));
    }
  };

  // Empty State
  if (sequences.length === 0) {
    return (
      <DashboardShell>
        <PageHeader title="Email Sequences" description="Create and manage multi-step email campaigns" />

        <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Rocket className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Create your first sequence</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Email sequences help you automate your outreach and follow-ups. Set up
            multi-step campaigns to engage with contacts systematically.
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 mb-6 text-left">
            <li>✓ Schedule multiple follow-ups automatically</li>
            <li>✓ Track opens, replies, and engagement</li>
            <li>✓ Personalize messages with variables</li>
            <li>✓ Pause or stop sequences based on responses</li>
          </ul>
          <Button size="lg" onClick={() => router.push("/dashboard/sequences/create")}>
            <Plus className="mr-2 h-5 w-5" />
            Create Your First Sequence
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Email Sequences"
        description={`${sequences.length} sequence${sequences.length !== 1 ? "s" : ""} • ${sequences.filter((s) => s.status === "active").length} active`}
        actions={
          <Button onClick={() => router.push("/dashboard/sequences/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Sequence
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sequences</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="created">Recently Created</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sequences Grid */}
      {sortedSequences.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No sequences found matching your filters
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedSequences.map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onPause={handlePause}
              onResume={handleResume}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
