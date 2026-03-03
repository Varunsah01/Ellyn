"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Mail,
  Download,
  Trash2,
  Eye,
  Search,
  Loader2,
  Inbox,
  RefreshCw,
} from "lucide-react";
import type { Lead } from "@/lib/supabase/types";
import { EmailComposer } from "./EmailComposer";

interface LeadsTableProps {
  refreshTrigger?: number;
}

/**
 * Render the LeadsTable component.
 * @param {LeadsTableProps} props - Component props.
 * @returns {unknown} JSX output for LeadsTable.
 * @example
 * <LeadsTable />
 */
export function LeadsTable({ refreshTrigger }: LeadsTableProps) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchLeads();
  }, [searchQuery, statusFilter, currentPage, refreshTrigger]);

  // Listen for lead updates from email composer
  useEffect(() => {
    const handleLeadUpdate = () => {
      fetchLeads();
    };
    window.addEventListener("lead-updated", handleLeadUpdate);
    return () => window.removeEventListener("lead-updated", handleLeadUpdate);
  }, []);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/v1/leads?${params}`);
      const data = await response.json();

      if (data.success) {
        setLeads(data.leads);
        setTotalPages(data.pagination.totalPages);
        setTotalLeads(data.pagination.total);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/leads/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchLeads(); // Refresh the list
      } else {
        console.error("Failed to delete lead");
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Person Name", "Company", "Email", "Confidence", "Status", "Date"];
    const rows = leads.map((lead) => [
      lead.person_name,
      lead.company_name,
      lead.selected_email || "",
      lead.discovered_emails.find((e) => e.email === lead.selected_email)?.confidence || "",
      lead.status,
      new Date(lead.created_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: Lead["status"]) => {
    const variants: Record<Lead["status"], { variant: "default" | "secondary" | "outline" | "destructive"; color: string }> = {
      discovered: { variant: "secondary", color: "text-gray-600" },
      sent: { variant: "default", color: "text-blue-600" },
      bounced: { variant: "destructive", color: "text-red-600" },
      replied: { variant: "outline", color: "text-green-600" },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getConfidenceForLead = (lead: Lead): number => {
    if (!lead.selected_email) return 0;
    const email = lead.discovered_emails.find((e) => e.email === lead.selected_email);
    return email?.confidence || 0;
  };

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoading && leads.length === 0 && !searchQuery && statusFilter === "all") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <Inbox className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Discover your first email to get started!
          </p>
          <Button onClick={() => (window.location.href = "/")}>
            <Search className="mr-2 h-4 w-4" />
            Discover Emails
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Saved Leads</h3>
          <p className="text-sm text-muted-foreground">
            {totalLeads} {totalLeads === 1 ? "lead" : "leads"} found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLeads}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={leads.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="discovered">Discovered</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-sm text-muted-foreground">
              No leads found matching your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Selected Email</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                >
                  <TableCell className="font-medium">{lead.person_name}</TableCell>
                  <TableCell>{lead.company_name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {lead.selected_email || (
                      <span className="text-muted-foreground">Not selected</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.selected_email && (
                      <Badge variant="outline">{getConfidenceForLead(lead)}%</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {lead.selected_email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                            setEmailComposerOpen(true);
                          }}
                          title="Send email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/leads/${lead.id}`);
                        }}
                        title="View lead details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(lead.id);
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Delete lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isLoading}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || isLoading}
          >
            Next
          </Button>
        </div>
      )}

      {/* Email Composer Dialog */}
      <EmailComposer
        open={emailComposerOpen}
        onOpenChange={setEmailComposerOpen}
        lead={selectedLead}
      />
    </div>
  );
}

