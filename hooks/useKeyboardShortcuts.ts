"use client";

import { useEffect } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;  // Cmd on Mac
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  description?: string;
}

/**
 * Hook to register keyboard shortcuts
 * @param shortcuts Array of keyboard shortcuts to register
 * @param enabled Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput && event.key !== "Escape") {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey || !shortcut.ctrl;
        const metaMatches = shortcut.meta ? event.metaKey : !event.metaKey || !shortcut.meta;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey || !shortcut.shift;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey || !shortcut.alt;

        // Check if all modifiers match
        const modifiersMatch =
          (shortcut.ctrl === undefined || event.ctrlKey === shortcut.ctrl) &&
          (shortcut.meta === undefined || event.metaKey === shortcut.meta) &&
          (shortcut.shift === undefined || event.shiftKey === shortcut.shift) &&
          (shortcut.alt === undefined || event.altKey === shortcut.alt);

        if (keyMatches && modifiersMatch) {
          event.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Common keyboard shortcuts for the app
 */
export const commonShortcuts = {
  commandPalette: {
    key: "k",
    meta: true,
    ctrl: true,
    description: "Open command palette",
  },
  search: {
    key: "f",
    meta: true,
    ctrl: true,
    description: "Search",
  },
  newContact: {
    key: "n",
    meta: true,
    ctrl: true,
    description: "New contact",
  },
  newSequence: {
    key: "e",
    meta: true,
    ctrl: true,
    description: "New email",
  },
  help: {
    key: "/",
    meta: true,
    ctrl: true,
    description: "Show help",
  },
  escape: {
    key: "Escape",
    description: "Close modal/dialog",
  },
  settings: {
    key: ",",
    meta: true,
    ctrl: true,
    description: "Open settings",
  },
};

/**
 * Hook for detecting if user is on Mac
 */
export function useIsMac() {
  return typeof window !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Format keyboard shortcut for display
 * @param shortcut Keyboard shortcut object
 * @param isMac Whether user is on Mac
 */
export function formatShortcut(
  shortcut: Partial<KeyboardShortcut>,
  isMac: boolean = false
): string {
  const parts: string[] = [];

  if (shortcut.ctrl && !isMac) parts.push("Ctrl");
  if (shortcut.meta || (shortcut.ctrl && isMac)) parts.push("⌘");
  if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  if (shortcut.key) parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}
