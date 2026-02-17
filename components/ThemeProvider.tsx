"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

/**
 * Render the ThemeProvider component.
 * @param {ThemeProviderProps} props - Component props.
 * @returns {unknown} JSX output for ThemeProvider.
 * @example
 * <ThemeProvider />
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
