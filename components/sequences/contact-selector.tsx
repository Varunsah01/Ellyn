"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Users, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  status: "new" | "contacted" | "responded" | "interested" | "not_interested";
  tags: string[];
}

interface ContactSelectorProps {
  selectedContactIds: string[];
  onChange: (contactIds: string[]) => void;
}

// Mock contacts data (replace with actual data from Supabase)
const mockContacts: Contact[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@google.com",
    company: "Google",
    role: "Software Engineer",
    status: "new",
    tags: ["engineering", "bay-area"],
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.j@meta.com",
    company: "Meta",
    role: "Product Manager",
    status: "contacted",
    tags: ["product", "remote"],
  },
  {
    id: "3",
    name: "Michael Chen",
    email: "m.chen@microsoft.com",
    company: "Microsoft",
    role: "Senior Software Engineer",
    status: "new",
    tags: ["engineering", "seattle"],
  },
  {
    id: "4",
    name: "Emily Rodriguez",
    email: "emily.r@apple.com",
    company: "Apple",
    role: "Design Lead",
    status: "responded",
    tags: ["design", "bay-area"],
  },
  {
    id: "5",
    name: "David Kim",
    email: "david.k@amazon.com",
    company: "Amazon",
    role: "Engineering Manager",
    status: "new",
    tags: ["engineering", "management", "seattle"],
  },
  {
    id: "6",
    name: "Lisa Wang",
    email: "lisa.w@netflix.com",
    company: "Netflix",
    role: "Data Scientist",
    status: "interested",
    tags: ["data-science", "remote"],
  },
  {
    id: "7",
    name: "James Brown",
    email: "james.b@salesforce.com",
    company: "Salesforce",
    role: "Sales Engineer",
    status: "new",
    tags: ["sales", "bay-area"],
  },
  {
    id: "8",
    name: "Maria Garcia",
    email: "maria.g@uber.com",
    company: "Uber",
    role: "Product Designer",
    status: "contacted",
    tags: ["design", "bay-area"],
  },
];

export function ContactSelector({
  selectedContactIds,
  onChange,
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Get unique companies for filter
  const companies = useMemo(() => {
    const uniqueCompanies = Array.from(
      new Set(mockContacts.map((c) => c.company))
    ).sort();
    return uniqueCompanies;
  }, []);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return mockContacts.filter((contact) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.role.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;

      // Company filter
      const matchesCompany =
        companyFilter === "all" || contact.company === companyFilter;

      return matchesSearch && matchesStatus && matchesCompany;
    });
  }, [searchQuery, statusFilter, companyFilter]);

  const toggleContact = (contactId: string) => {
    if (selectedContactIds.includes(contactId)) {
      onChange(selectedContactIds.filter((id) => id !== contactId));
    } else {
      onChange([...selectedContactIds, contactId]);
    }
  };

  const selectAll = () => {
    const allFilteredIds = filteredContacts.map((c) => c.id);
    onChange(allFilteredIds);
  };

  const deselectAll = () => {
    onChange([]);
  };

  const statusColors: Record<Contact["status"], string> = {
    new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    responded: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    interested: "bg-green-500/10 text-green-500 border-green-500/20",
    not_interested: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const statusLabels: Record<Contact["status"], string> = {
    new: "New",
    contacted: "Contacted",
    responded: "Responded",
    interested: "Interested",
    not_interested: "Not Interested",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {selectedContactIds.length} of {filteredContacts.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={filteredContacts.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={selectedContactIds.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="responded">Responded</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
          </SelectContent>
        </Select>

        {/* Company Filter */}
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact List */}
      <div className="border rounded-lg">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No contacts found</p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCompanyFilter("all");
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {filteredContacts.map((contact) => {
              const isSelected = selectedContactIds.includes(contact.id);

              return (
                <div
                  key={contact.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/5"
                  )}
                  onClick={() => toggleContact(contact.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground hover:border-primary"
                        )}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", statusColors[contact.status])}
                        >
                          {statusLabels[contact.status]}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-muted-foreground">
                          {contact.role} at {contact.company}
                        </p>
                      </div>

                      {contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contact.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs px-2 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Summary */}
      {selectedContactIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedContactIds.length} contact
                  {selectedContactIds.length !== 1 ? "s" : ""} will be enrolled in
                  this sequence
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="h-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
