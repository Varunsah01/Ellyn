"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { mainNavItems, secondaryNavItems } from "@/lib/constants/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStats } from "@/lib/hooks/useAnalytics";
import { useSequenceStats } from "@/lib/hooks/useSequences";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  const { stats } = useDashboardStats();
  const { stats: sequenceStats } = useSequenceStats();

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
          {mainNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            // Map legacy stats to new structure
            let count: number | undefined;
            if (item.href === "/dashboard/contacts") {
              count = stats.totalContacts;
            } else if (item.href === "/dashboard/templates") {
              count = sequenceStats.totalTemplates;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary/70")} />
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
                <AvatarImage src="/placeholder-avatar.png" alt="User" />
                <AvatarFallback className="bg-primary/10 text-primary">VK</AvatarFallback>
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
                      Varun Kumar
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      varun@ellyn.app
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
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
            
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
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
