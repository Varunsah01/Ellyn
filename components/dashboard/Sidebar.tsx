"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { mainNavItems, secondaryNavItems, type NavItem } from "@/lib/constants/navigation";
import { ChevronLeft, LifeBuoy, LogOut, Sparkles, LayoutDashboard, BarChart2 } from "lucide-react";
import { usePersona } from "@/context/PersonaContext";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStats } from "@/lib/hooks/useAnalytics";
import { useSequenceStats } from "@/lib/hooks/useSequences";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useSubscription } from "@/context/SubscriptionContext";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function buildAvatarInitials(name: string): string {
  const normalized = String(name || "").trim();
  if (!normalized) return "?";

  const initials = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "?";
}

/**
 * Render the Sidebar component.
 * @param {SidebarProps} props - Component props.
 * @returns {unknown} JSX output for Sidebar.
 * @example
 * <Sidebar />
 */
export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { stats } = useDashboardStats();
  const { stats: sequenceStats } = useSequenceStats();
  const { plan_type } = useSubscription();
  const { isJobSeeker, isSalesRep } = usePersona();
  const isPaidUser = plan_type === "pro";
  const [userFullName, setUserFullName] = useState("Account");
  const [userEmail, setUserEmail] = useState("");
  const [avatarInitials, setAvatarInitials] = useState("?");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [newExtensionContacts, setNewExtensionContacts] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      if (!isSupabaseConfigured) return;

      const { data, error } = await supabase.auth.getUser();
      if (!isMounted || error || !data.user) return;

      const authUser = data.user;
      const email = String(authUser.email || "").trim();
      const metadata =
        authUser.user_metadata && typeof authUser.user_metadata === "object"
          ? (authUser.user_metadata as Record<string, unknown>)
          : {};

      const emailPrefix = email.split("@")[0] || "Account";
      const resolvedName = String(
        metadata.full_name || metadata.name || emailPrefix || "Account"
      ).trim();

      setUserEmail(email);
      setUserFullName(resolvedName || "Account");
      setAvatarInitials(buildAvatarInitials(resolvedName || emailPrefix));
      setAvatarUrl(String(metadata.avatar_url || "").trim());
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/contacts?source=extension&since=24h&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { totalCount?: number } | null) => {
        if (isMounted && typeof data?.totalCount === "number") {
          setNewExtensionContacts(data.totalCount);
        }
      })
      .catch(() => undefined);
    return () => { isMounted = false; };
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      router.replace("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
      router.replace("/auth/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative border-r bg-card flex flex-col h-full z-20"
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <Link href="/dashboard" className="relative h-10 w-[120px]">
                <img
                  src="https://subsnacks.sirv.com/Ellyn_logo.png"
                  alt="Ellyn logo"
                  className="h-full w-full object-contain"
                />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <Link href="/dashboard" className="w-8 h-8 mx-auto flex items-center justify-center">
             <img
              src="https://subsnacks.sirv.com/Ellyn_logo.png"
              alt="Ellyn logo"
              className="h-full w-full object-contain"
            />
          </Link>
        )}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {((): NavItem[] => {
              const items = [...mainNavItems]
              const contactsIdx = items.findIndex((i) => i.href === "/dashboard/contacts")
              if (isJobSeeker) {
                const trackerItem: NavItem = {
                  name: "Tracker",
                  href: "/dashboard/tracker",
                  icon: LayoutDashboard,
                }
                items.splice(contactsIdx + 1, 0, trackerItem)
              }
              if (isSalesRep) {
                const pipelineItem: NavItem = {
                  name: "Pipeline",
                  href: "/dashboard/pipeline",
                  icon: BarChart2,
                }
                items.splice(contactsIdx + 1, 0, pipelineItem)
              }
              return items
            })().map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            // Map legacy stats to new structure
            let count: number | undefined;
            let extensionBadge = false;
            if (item.href === "/dashboard/contacts") {
              count = stats.totalContacts;
              extensionBadge = newExtensionContacts > 0;
            } else if (item.href === "/dashboard/templates") {
              count = sequenceStats.totalTemplates;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group border-l-2",
                  isActive
                    ? "bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]"
                    : "text-muted-foreground border-transparent hover:bg-secondary/60 hover:text-foreground hover:translate-x-0.5"
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-[#FF6B6B]" : "group-hover:text-foreground/70")} />
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="truncate"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                {count !== undefined && count > 0 && !collapsed && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] h-5 px-1.5 bg-background border"
                  >
                    {count}
                  </Badge>
                )}
                {extensionBadge && !collapsed && (
                  <Badge
                    className="ml-1 text-[10px] h-5 px-1.5 bg-[#0A66C2] text-white border-0"
                    title={`${newExtensionContacts} new contact${newExtensionContacts !== 1 ? "s" : ""} from extension in last 24h`}
                  >
                    +{newExtensionContacts}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="border-t p-3 bg-background/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-3 py-2.5 h-auto hover:bg-secondary/50",
                collapsed && "justify-center px-2"
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background">
                <AvatarImage src={avatarUrl || undefined} alt={userFullName} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-start text-left overflow-hidden"
                  >
                    <span className="text-sm font-medium truncate w-full text-foreground">
                      {userFullName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {userEmail}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-64 mb-2">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm text-foreground">{userFullName}</span>
                <span className="text-xs text-muted-foreground">{userEmail}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Secondary Items */}
            {secondaryNavItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className="cursor-pointer">
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {item.name}
                </Link>
              </DropdownMenuItem>
            ))}

            {!isPaidUser && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing/upgrade" className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                  Upgrade / Plan
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a
                href="https://ellyn.app/support"
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer"
              >
                <LifeBuoy className="mr-2 h-4 w-4 text-muted-foreground" />
                Help &amp; Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
              disabled={isSigningOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background shadow-md hidden lg:flex hover:bg-secondary text-muted-foreground"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )}
        />
      </Button>
    </motion.aside>
  );
}
