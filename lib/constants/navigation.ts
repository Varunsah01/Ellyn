import {
  Home,
  Users,
  Send,
  FileText,
  BarChart2,
  Gauge,
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
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Sent Emails",
    href: "/dashboard/sent",
    icon: Send,
  },
  {
    name: "Contacts",
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
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart2,
  },
  {
    name: "Performance",
    href: "/dashboard/performance",
    icon: Gauge,
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
