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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyContacts } from "@/components/EmptyState";
import { showToast } from "@/lib/toast";
import { matchesTrackerSearch } from "@/lib/tracker-v2";
import {
  buildTrackerContactHref,
  saveTrackerDeepLinkContact,
  toTrackerContact,
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
};

// Mock data - replace with real data from Supabase
const mockContacts: Contact[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@google.com",
    company: "Google",
    role: "Senior Software Engineer",
    status: "contacted",
    lastContact: "2024-02-01",
    source: "LinkedIn",
    tags: ["Engineering", "Senior"],
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.j@meta.com",
    company: "Meta",
    role: "Product Manager",
    status: "responded",
    lastContact: "2024-02-03",
    source: "LinkedIn",
    tags: ["Product", "Management"],
  },
  {
    id: "3",
    name: "Michael Chen",
    email: "m.chen@microsoft.com",
    company: "Microsoft",
    role: "Engineering Manager",
    status: "interested",
    lastContact: "2024-02-05",
    source: "Referral",
    tags: ["Engineering", "Management"],
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily.davis@apple.com",
    company: "Apple",
    role: "UX Designer",
    status: "new",
    lastContact: "2024-02-06",
    source: "LinkedIn",
    tags: ["Design", "UX"],
  },
  {
    id: "5",
    name: "David Wilson",
    email: "d.wilson@amazon.com",
    company: "Amazon",
    role: "Data Scientist",
    status: "not_interested",
    lastContact: "2024-01-28",
    source: "LinkedIn",
    tags: ["Data", "ML"],
  },
];

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
  not_interested: "Not Interested",
};

/**
 * Render the ContactsTable component.
 * @returns {unknown} JSX output for ContactsTable.
 * @example
 * <ContactsTable />
 */
export function ContactsTable() {
  const router = useRouter();
  const contacts = mockContacts;

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

  // Show empty state if no contacts
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
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      filterFn: (row, _columnId, value) => {
        const query = String(value || "");
        return matchesTrackerSearch(
          toTrackerContact({
            id: row.original.id,
            full_name: row.original.name,
            company: row.original.company,
            role: row.original.role,
            inferred_email: row.original.email,
            status: row.original.status,
          }),
          query
        );
      },
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
              <button
                type="button"
                className="font-medium text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7B7B]/40 rounded-sm"
                onClick={() => openInTracker(contact)}
                aria-label={`Open ${contact.name} in tracker`}
              >
                {contact.name}
              </button>
              <div className="text-sm text-muted-foreground">
                {contact.role}
              </div>
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
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(contact.email);
                showToast.success("Email copied to clipboard");
              }}>
                <Mail className="mr-2 h-4 w-4" />
                Copy email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  openInTracker(contact);
                }}
              >
                <KanbanSquare className="mr-2 h-4 w-4" />
                View in Tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => showToast.info("View details coming soon")}>
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => showToast.info("Edit contact coming soon")}>
                <Edit className="mr-2 h-4 w-4" />
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => showToast.error("Delete functionality coming soon")}
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
      searchKey="name"
      searchPlaceholder="Search contacts..."
    />
  );
}
