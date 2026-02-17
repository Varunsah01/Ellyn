"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Render the Breadcrumbs component.
 * @param {BreadcrumbsProps} props - Component props.
 * @returns {unknown} JSX output for Breadcrumbs.
 * @example
 * <Breadcrumbs />
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
    >
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center space-x-1">
            <ChevronRight className="h-4 w-4" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && "text-foreground font-medium")}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
