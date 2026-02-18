"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Linkedin } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STATUS_PILLS = [
  { label: "All", value: "" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Replied", value: "replied" },
  { label: "No Response", value: "no_response" },
] as const;

const SOURCE_PILLS = [
  { label: "All Sources", value: "" },
  { label: "Manual", value: "manual" },
  { label: "Extension", value: "extension" },
  { label: "CSV Import", value: "csv_import" },
] as const;

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  company: "",
  role: "",
  inferredEmail: "",
};

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      showToast.success("Contact added");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell breadcrumbs={[{ label: "Contacts" }]}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSource(source === "extension" ? "" : "extension")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                source === "extension"
                  ? "border-[#0A66C2] bg-[#0A66C2]/10 text-[#0A66C2]"
                  : "border-input bg-background text-muted-foreground hover:border-[#0A66C2]/50 hover:text-foreground"
              )}
            >
              <Linkedin className="h-3.5 w-3.5" />
              From Extension
            </button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setStatus(pill.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                status === pill.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Source filter pills */}
        <div className="flex flex-wrap gap-2">
          {SOURCE_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setSource(pill.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                source === pill.value
                  ? "border-[#0A66C2] bg-[#0A66C2]/10 text-[#0A66C2]"
                  : "border-input bg-background text-muted-foreground hover:border-[#0A66C2]/50 hover:text-foreground"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Contacts table — key forces remount/refetch on status, source, search, or after add */}
        <ContactsTable
          key={`${debouncedSearch}-${status}-${source}-${refreshKey}`}
          search={debouncedSearch}
          status={status}
          source={source}
        />
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setForm(EMPTY_FORM); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="firstName"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="lastName"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="company" className="text-sm font-medium">
                Company <span className="text-destructive">*</span>
              </label>
              <Input
                id="company"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role" className="text-sm font-medium">Role</label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inferredEmail" className="text-sm font-medium">Email</label>
              <Input
                id="inferredEmail"
                type="email"
                value={form.inferredEmail}
                onChange={(e) => setForm({ ...form, inferredEmail: e.target.value })}
                placeholder="jane@acme.com"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); setForm(EMPTY_FORM); }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
