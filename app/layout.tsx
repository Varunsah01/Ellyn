import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Initialize DM Sans
const dm_sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Initialize Fraunces
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ellyn - Creativity Needs a Canvas",
  description:
    "Ellyn exists at the intersection of precision and play. We provide the tools; you provide the art. Build digital experiences that feel as tactile and personal as a brushstroke on canvas.",
  keywords: [
    "ellyn",
    "creative tools",
    "digital experience",
    "design platform",
    "art tech",
    "tactile design",
    "personal expression",
  ],
  authors: [{ name: "Ellyn" }],
  openGraph: {
    title: "Ellyn - Creativity Needs a Canvas",
    description:
      "Ellyn exists at the intersection of precision and play. We provide the tools; you provide the art. Build digital experiences that feel as tactile and personal as a brushstroke on canvas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dm_sans.variable} ${fraunces.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
