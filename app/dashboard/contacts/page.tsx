"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Upload } from "lucide-react";
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
import {
  FilterPanel,
  DEFAULT_FILTERS,
  type ContactFilters,
} from "@/components/contacts/FilterPanel";
import { useAllUserTags } from "@/lib/hooks/useAllUserTags";
import { usePersona } from "@/context/PersonaContext";
import { getPersonaCopy } from "@/lib/persona-copy";
import { showToast } from "@/lib/toast";
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch";
import { CsvImportDialog } from "@/components/contacts/CsvImportDialog";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  company: "",
  role: "",
  inferredEmail: "",
};

export default function ContactsPage() {
  const { persona } = usePersona();
  const copy = getPersonaCopy(persona);
  const allUserTags = useAllUserTags();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await supabaseAuthedFetch("/api/v1/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      showToast.success(`${copy.contactSingular} added`);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      showToast.error(
        err instanceof Error
          ? err.message
          : `Failed to add ${copy.contactSingular.toLowerCase()}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell breadcrumbs={[{ label: copy.contacts }]}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${copy.contacts.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterPanel
              filters={filters}
              allUserTags={allUserTags}
              onChange={setFilters}
            />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {copy.addContact}
            </Button>
          </div>
        </div>

        {/* Contacts table — key forces remount/refetch on search or after add */}
        <ContactsTable
          key={`${debouncedSearch}-${refreshKey}`}
          search={debouncedSearch}
          filters={filters}
        />
      </div>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false)
          setRefreshKey((k) => k + 1)
        }}
      />

      {/* Add Contact Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.addContact}</DialogTitle>
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
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
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
                onChange={(e) =>
                  setForm({ ...form, company: e.target.value })
                }
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inferredEmail" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="inferredEmail"
                type="email"
                value={form.inferredEmail}
                onChange={(e) =>
                  setForm({ ...form, inferredEmail: e.target.value })
                }
                placeholder="jane@acme.com"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding…" : copy.addContact}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
