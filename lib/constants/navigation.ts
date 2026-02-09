import {
  Home,
  Users,
  Send,
  FileText,
  Pencil,
  BarChart2,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

// The "Calm Desk" Navigation
export const mainNavItems: NavItem[] = [
  {
    name: "Focus",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Drafts",
    href: "/dashboard/drafts",
    icon: Pencil,
  },
  {
    name: "Sent",
    href: "/dashboard/sent",
    icon: Send,
  },
  {
    name: "People",
    href: "/dashboard/contacts",
    icon: Users,
  },
  {
    name: "Templates",
    href: "/dashboard/templates",
    icon: FileText,
  },
];

// Secondary items to be tucked away in the profile menu
export const secondaryNavItems: NavItem[] = [
  {
    name: "Insights",
    href: "/dashboard/analytics",
    icon: BarChart2,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
  {
    name: "Billing",
    href: "/dashboard/settings/billing", // Assuming this route, can adjust later
    icon: CreditCard,
  },
];