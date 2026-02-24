"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface DashboardWrapperProps {
  children: React.ReactNode;
}

/**
 * Render the DashboardWrapper component.
 * @param {DashboardWrapperProps} props - Component props.
 * @returns {unknown} JSX output for DashboardWrapper.
 * @example
 * <DashboardWrapper />
 */
export function DashboardWrapper({ children }: DashboardWrapperProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const router = useRouter();

  // Register global keyboard shortcuts
  useKeyboardShortcuts([
    // Command Palette
    {
      key: "k",
      meta: true,
      callback: () => setCommandOpen(true),
    },
    {
      key: "k",
      ctrl: true,
      callback: () => setCommandOpen(true),
    },
    // Quick navigation
    {
      key: "h",
      meta: true,
      callback: () => router.push("/dashboard"),
    },
    {
      key: "h",
      ctrl: true,
      callback: () => router.push("/dashboard"),
    },
    {
      key: "c",
      meta: true,
      callback: () => router.push("/dashboard/contacts"),
    },
    {
      key: "c",
      ctrl: true,
      callback: () => router.push("/dashboard/contacts"),
    },
    {
      key: "t",
      meta: true,
      callback: () => router.push("/dashboard/sequences"),
    },
    {
      key: "t",
      ctrl: true,
      callback: () => router.push("/dashboard/sequences"),
    },
    {
      key: "e",
      meta: true,
      callback: () => router.push("/compose"),
    },
    {
      key: "e",
      ctrl: true,
      callback: () => router.push("/compose"),
    },
    // Escape to close modals
    {
      key: "Escape",
      callback: () => setCommandOpen(false),
    },
  ]);

  return (
    <>
      {children}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
