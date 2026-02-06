"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export function DashboardShell({
  children,
  loading = false,
  className,
}: DashboardShellProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-6", className)}
    >
      {children}
    </motion.div>
  );
}
