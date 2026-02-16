"use client";

import { Menu, Search, Command, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { useMemo, useState } from "react";
import { GlobalSearch } from "./global-search";
import { NotificationsDropdown, type Notification } from "./notifications-dropdown";
import { Badge } from "@/components/ui/badge";
import { usePathname, useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

const mockNotifications: Notification[] = [
  { id: "1", type: "reply", title: "New Reply Received", message: "John Smith replied to your outreach email", timestamp: new Date(Date.now() - 1000 * 60 * 30), read: false, actionUrl: "/dashboard/contacts" },
  { id: "2", type: "sequence_complete", title: "Sequence Completed", message: "Software Engineer Outreach Q1 2024 has completed", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false },
  { id: "3", type: "contact_added", title: "Contact Added", message: "Sarah Johnson was added via Chrome extension", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), read: true },
];

export function Header({ breadcrumbs }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const currentSectionLabel = useMemo(() => {
    const sectionMap: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/dashboard/contacts": "Contacts",
      "/dashboard/templates": "Templates",
      "/dashboard/sequences": "Sequences",
      "/dashboard/analytics": "Analytics",
      "/dashboard/sent": "Sent Emails",
      "/dashboard/settings": "Settings",
    };

    const exact = sectionMap[pathname];
    if (exact) return exact;

    const match = Object.entries(sectionMap).find(([route]) => pathname.startsWith(`${route}/`));
    return match?.[1] || "Dashboard";
  }, [pathname]);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }

    setIsSigningOut(false);
    router.replace("/auth/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="sm:hidden">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-72 p-0">
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </SheetContent>
        </Sheet>

        <div className="sm:hidden">
          <p className="text-sm font-medium text-foreground">{currentSectionLabel}</p>
        </div>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden lg:flex items-center space-x-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-muted-foreground">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Search Button */}
        <div className="flex-1 max-w-md ml-auto">
          <Button variant="outline" className="w-full justify-start text-muted-foreground h-9" onClick={() => setSearchOpen(true)}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search pages, contacts, templates...</span>
            <Badge variant="secondary" className="ml-auto gap-1"><Command className="h-3 w-3" />K</Badge>
          </Button>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <NotificationsDropdown
            notifications={notifications}
            onMarkAsRead={(id) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))}
            onMarkAllAsRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
