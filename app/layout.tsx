import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { CsrfFetchProvider } from "@/components/CsrfFetchProvider";
import { WebVitalsReporter } from "@/components/monitoring/WebVitalsReporter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { Toaster as HotToaster } from "react-hot-toast";

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
  title: "Ellyn - Professional Email Finder & Outreach Platform | Find Anyone's Email",
  description:
    "Find verified professional emails for hiring managers, prospects, or decision-makers. AI-powered outreach drafts, contact management, and email verification. 95%+ accuracy. Start free.",
  keywords: [
    "professional email finder",
    "email discovery platform",
    "find professional emails",
    "cold email outreach",
    "sales email finder",
    "email pattern finder",
    "free Hunter.io alternative",
    "LinkedIn email finder",
    "B2B email finder",
    "SDR prospecting tool",
    "email verification",
    "email outreach templates",
    "hiring manager emails",
    "cold outreach platform",
    "AI email drafting",
  ],
  authors: [{ name: "Ellyn" }],
  openGraph: {
    title: "Ellyn - Find Professional Emails & Send Personalized Outreach",
    description:
      "Discover verified emails, craft AI-powered messages, and manage your outreach pipeline. Trusted by job seekers and sales teams. Free to start.",
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
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <CsrfFetchProvider />
          <WebVitalsReporter />
          {children}
          <Toaster />
          <HotToaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
