import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { CsrfFetchProvider } from "@/components/CsrfFetchProvider";
import { WebVitalsReporter } from "@/components/monitoring/WebVitalsReporter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import { validateEnv } from "@/lib/env";
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

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const isSupabaseConfigured = Boolean(publicSupabaseUrl && publicSupabaseAnonKey);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ellyn.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Ellyn — Email Finder & Outreach Platform | Find Anyone's Professional Email",
    template: "%s | Ellyn",
  },
  description:
    "Ellyn is the fast, affordable email finder that surfaces verified professional emails with 95%+ accuracy. AI-powered outreach drafts, contact management, and email verification. Free to start.",
  keywords: [
    "ellyn",
    "ellyn email finder",
    "ellyn.app",
    "ellyn email",
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
    "email finder tool",
    "find business email",
  ],
  authors: [{ name: "Ellyn", url: APP_URL }],
  creator: "Ellyn",
  publisher: "Eigenspace Technologies PVT. Ltd.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Ellyn — Find Professional Emails & Send Personalized Outreach",
    description:
      "Ellyn finds verified professional emails with 95%+ accuracy at a fraction of Hunter.io's cost. AI-powered outreach drafts, contact management, and email verification. Free to start.",
    type: "website",
    url: APP_URL,
    siteName: "Ellyn",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ellyn — Professional Email Finder & Outreach Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ellyn — Find Anyone's Professional Email",
    description:
      "Verified professional emails with 95%+ accuracy. AI-powered outreach drafts. Free to start.",
    images: ["/og-image.png"],
    creator: "@ellyn_app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  validateEnv();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dm_sans.variable} ${fraunces.variable} antialiased`}
        data-supabase-configured={isSupabaseConfigured ? "true" : "false"}
      >
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
