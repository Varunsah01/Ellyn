"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload } from "lucide-react";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { AddContactDialog } from "@/components/contacts/add-contact-dialog";

export default function ContactsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <DashboardShell>
      <PageHeader
        title="Contacts"
        description="Manage your outreach contacts and track engagement"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        }
      />

      <ContactsTable />

      <AddContactDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </DashboardShell>
  );
}
