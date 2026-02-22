"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/dashboard/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  MoreHorizontal,
  Mail,
  KanbanSquare,
  Eye,
  Edit,
  Trash,
  ArrowUpDown,
  Linkedin,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyContacts } from "@/components/EmptyState";
import { showToast } from "@/lib/toast";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useContacts, type Contact as ApiContact } from "@/lib/hooks/useContacts";
import {
  buildTrackerContactHref,
  saveTrackerDeepLinkContact,
} from "@/lib/tracker-integration";

export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  status: "new" | "contacted" | "responded" | "interested" | "not_interested";
  lastContact: string;
  source: string;
  tags: string[];
  linkedinUrl?: string;
};

const API_STATUS_MAP: Record<ApiContact["status"], Contact["status"]> = {
  new: "new",
  contacted: "contacted",
  replied: "responded",
  no_response: "not_interested",
};

function toLocalContact(api: ApiContact): Contact {
  return {
    id: api.id,
    name: api.full_name,
    email: api.confirmed_email ?? api.inferred_email ?? "",
    company: api.company ?? "",
    role: api.role ?? "",
    status: API_STATUS_MAP[api.status],
    lastContact: api.updated_at,
    source: api.source ?? "",
    tags: api.tags ?? [],
    linkedinUrl: api.linkedin_url ?? undefined,
  };
}

const statusColors = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  responded: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  interested: "bg-green-500/10 text-green-500 border-green-500/20",
  not_interested: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels = {
  new: "New",
  contacted: "Contacted",
  responded: "Responded",
  interested: "Interested",
  not_interested: "No Response",
};

const sourceConfig: Record<string, { label: string; className: string }> = {
  extension: { label: "Extension", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  manual: { label: "Manual", className: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  csv: { label: "CSV Import", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  csv_import: { label: "CSV Import", className: "bg-green-500/10 text-green-600 border-green-500/20" },
};

function getSourceConfig(source: string) {
  const key = source.toLowerCase();
  return sourceConfig[key] ?? { label: source || "Manual", className: "bg-slate-500/10 text-slate-600 border-slate-500/20" };
}

interface ContactsTableProps {
  search?: string;
  status?: string;
  source?: string;
}

export function ContactsTable({ search = "", status = "", source = "" }: ContactsTableProps) {
  const router = useRouter();
  const { contacts: apiContacts, loading, error, refresh } = useContacts({ search, status, source });
  const contacts = apiContacts.map(toLocalContact);

  if (loading) {
    return <ListSkeleton count={5} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-sm text-muted-foreground">
          Failed to load contacts. Please try again.
        </p>
        <p className="max-w-xl text-center text-xs text-muted-foreground/80">
          {error}
        </p>
        <Button variant="outline" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const openInTracker = (contact: Contact) => {
    saveTrackerDeepLinkContact({
      id: contact.id,
      full_name: contact.name,
      company: contact.company,
      role: contact.role,
      inferred_email: contact.email,
      status: contact.status,
    });
    router.push(buildTrackerContactHref(contact.id, { source: "contacts" }));
  };

  if (contacts.length === 0) {
    return <EmptyContacts />;
  }

  const columns: ColumnDef<Contact>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const contact = row.original;
        const initials = contact.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{contact.name}</div>
              <div className="text-sm text-muted-foreground">{contact.role}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue("email")}</div>
      ),
    },
    {
      accessorKey: "company",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Company
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as Contact["status"];
        return (
          <Badge
            variant="outline"
            className={cn("font-medium", statusColors[status])}
          >
            {statusLabels[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const source = row.getValue("source") as string;
        const cfg = getSourceConfig(source);
        return (
          <Badge variant="outline" className={cn("font-medium", cfg.className)}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      id: "linkedin",
      header: "LinkedIn",
      cell: ({ row }) => {
        const url = row.original.linkedinUrl;
        if (!url) return null;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-[#0A66C2] hover:text-[#0A66C2]/80 transition-colors"
              title="View LinkedIn profile"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              title="Open in Extension"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        );
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const tags = row.getValue("tags") as string[];
        return (
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "lastContact",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Contact
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("lastContact"));
        return <div>{date.toLocaleDateString()}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const contact = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(contact.email);
                showToast.success("Email copied to clipboard");
              }}>
                <Mail className="mr-2 h-4 w-4" />
                Copy email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openInTracker(contact);
                }}
              >
                <KanbanSquare className="mr-2 h-4 w-4" />
                View in Tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/contacts/${contact.id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                showToast.info("Edit contact coming soon");
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  showToast.error("Delete functionality coming soon");
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={contacts}
      onRowClick={(contact) => router.push(`/dashboard/contacts/${contact.id}`)}
    />
  );
}
