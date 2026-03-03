"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Briefcase,
  CreditCard,
  ExternalLink,
  FileText,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { BreadcrumbItem, Breadcrumbs } from "@/components/Breadcrumbs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { PlanBadge } from "@/components/subscription/PlanBadge";
import { QuotaWarningBanner } from "@/components/subscription/QuotaWarningBanner";
import { usePersona } from "@/context/PersonaContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DashboardPersona = "job_seeker" | "smb_sales";

type DashboardNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface DashboardShellProps {
  children: ReactNode;
  loading?: boolean;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
  withChrome?: boolean;
}

type UserInfo = {
  name: string;
  email: string;
  avatarUrl: string;
};

const SIDEBAR_LOGO_CDN =
  process.env.NEXT_PUBLIC_BRAND_LOGO_CDN?.trim() || "https://subsnacks.sirv.com/Ellyn_logo.png";

function getPersonaNav(persona: DashboardPersona): DashboardNavItem[] {
  const baseItems: DashboardNavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Contacts", href: "/dashboard/contacts", icon: Users },
    { label: "Sequences", href: "/dashboard/sequences", icon: GitBranch },
    { label: "Templates", href: "/dashboard/templates", icon: FileText },
  ];

  const personaSpecific: DashboardNavItem =
    persona === "job_seeker"
      ? { label: "Tracker", href: "/tracker", icon: Target }
      : { label: "Pipeline", href: "/dashboard/pipeline", icon: TrendingUp };

  return [
    ...baseItems,
    personaSpecific,
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function toInitials(name: string, fallback = "U"): string {
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const initials = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || fallback;
}

function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { persona, setPersona } = usePersona();
  const { planType } = useSubscription();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: "User",
    email: "",
    avatarUrl: "",
  });

  const navItems = useMemo(() => getPersonaNav(persona), [persona]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      const metadata =
        user.user_metadata && typeof user.user_metadata === "object"
          ? (user.user_metadata as Record<string, unknown>)
          : {};

      const email = String(user.email ?? "").trim();
      const name = String(metadata.full_name ?? metadata.name ?? email.split("@")[0] ?? "User").trim();
      const avatarUrl = String(metadata.avatar_url ?? "").trim();

      setUserInfo({
        name: name || "User",
        email,
        avatarUrl,
      });
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA] text-[#2D2B55]">
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-[#E9E7F5] bg-[#F9F8FE] text-[#5D5A86] md:flex">
        <div className="flex h-[72px] items-center border-b border-[#E9E7F5] px-5">
          <Link href="/dashboard" className="inline-flex items-center">
            <img src={SIDEBAR_LOGO_CDN} alt="Ellyn" className="h-10 w-auto object-contain" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-[#FFC2C2] bg-[#FFF0F2] text-[#F2616D]"
                    : "border-transparent text-[#605B83] hover:bg-white hover:text-[#403B6C]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E9E7F5] px-3 py-4">
          <p className="mb-2 px-2 text-xs uppercase tracking-wide text-[#79759B]">Persona</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void setPersona("job_seeker")}
              className={cn(
                "flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors",
                persona === "job_seeker"
                  ? "bg-[#FF6B6B] text-white"
                  : "bg-white text-[#625D86] hover:bg-[#F1EFFA]"
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => void setPersona("smb_sales")}
              className={cn(
                "flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors",
                persona === "smb_sales"
                  ? "bg-[#FF6B6B] text-white"
                  : "bg-white text-[#625D86] hover:bg-[#F1EFFA]"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Sales
            </button>
          </div>
        </div>

        <div className="border-t border-[#E9E7F5] px-3 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
              >
                <Avatar className="h-10 w-10 border border-[#E1DEF2]">
                  <AvatarImage src={userInfo.avatarUrl || undefined} alt={userInfo.name} />
                  <AvatarFallback className="bg-[#EEECFA] text-[#413C69]">
                    {toInitials(userInfo.name, "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2D2B55]">{userInfo.name}</p>
                  <p className="truncate text-xs text-[#706A97]">{userInfo.email || "No email"}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="mb-2 w-64 border-[#E9E7F5] bg-white text-[#4B4673]"
            >
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-semibold uppercase tracking-wide text-[#474270]">
                  {userInfo.name}
                </p>
                <p className="truncate text-xs text-[#7A75A0]">{userInfo.email || "No email"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex cursor-pointer items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings?tab=billing" className="flex cursor-pointer items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/upgrade" className="flex cursor-pointer items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Upgrade / Plan
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href="https://ellyn.app/support"
                  target="_blank"
                  rel="noreferrer"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Help &amp; Support
                  <ExternalLink className="ml-auto h-3.5 w-3.5 text-[#9A96B7]" />
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                className="cursor-pointer text-[#4B4673] focus:text-[#4B4673]"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mt-3 flex items-center px-2">
            <PlanBadge
              plan={planType}
              className={planType === "free" ? "bg-white text-[#2D2B55] ring-1 ring-[#DDD9F2]" : undefined}
            />
          </div>
        </div>
      </aside>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-[#120f2fcc] md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside
            className="h-full w-60 border-r border-[#E9E7F5] bg-[#F9F8FE] px-3 py-4 text-[#5D5A86]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between px-2">
              <Link href="/dashboard" className="inline-flex items-center">
                <img src={SIDEBAR_LOGO_CDN} alt="Ellyn" className="h-10 w-auto object-contain" />
              </Link>
              <button type="button" onClick={() => setMobileSidebarOpen(false)} className="text-[#4A4576]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-[#FFC2C2] bg-[#FFF0F2] text-[#F2616D]"
                        : "border-transparent text-[#605B83] hover:bg-white hover:text-[#403B6C]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-[#E6E4F2] bg-white px-4 md:hidden">
          <button type="button" onClick={() => setMobileSidebarOpen(true)} className="text-[#2D2B55]">
            <Menu className="h-5 w-5" />
          </button>
          <img src={SIDEBAR_LOGO_CDN} alt="Ellyn" className="ml-3 h-8 w-auto object-contain" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <QuotaWarningBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Render the DashboardShell component.
 * @param {DashboardShellProps} props - Component props.
 * @returns {unknown} JSX output for DashboardShell.
 * @example
 * <DashboardShell />
 */
export function DashboardShell({
  children,
  loading = false,
  className,
  breadcrumbs,
  withChrome = false,
}: DashboardShellProps) {
  if (withChrome) {
    return <DashboardChrome>{children}</DashboardChrome>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <span className="text-sm text-[#5E5B86]">Loading...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} className="mb-4" />
      ) : null}
      {children}
    </div>
  );
}
