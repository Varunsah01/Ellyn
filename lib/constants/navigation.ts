import {
  Home,
  Users,
  Send,
  FileText,
  Settings,
  CreditCard,
  Layers,
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
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Contacts",
    href: "/dashboard/contacts",
    icon: Users,
  },
  {
    name: "Sequences",
    href: "/dashboard/sequences",
    icon: Layers,
  },
  {
    name: "Templates",
    href: "/dashboard/templates",
    icon: FileText,
  },
  {
    name: "Sent Emails",
    href: "/dashboard/sent",
    icon: Send,
  },
];

// Secondary items to be tucked away in the profile menu
export const secondaryNavItems: NavItem[] = [
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
