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
  title: "Ellyn - Find Emails & Get Referrals for Your Job Search | Free LinkedIn Email Finder",
  description:
    "Stop sending your resume into the void. Find professional emails on LinkedIn, draft personalized outreach, and get referrals from decision-makers. 100% free, zero LinkedIn ban risk. 850+ interviews landed in 90 days.",
  keywords: [
    "LinkedIn email finder",
    "job search referrals",
    "find professional emails",
    "cold email outreach",
    "job referral tool",
    "email pattern finder",
    "free Hunter.io alternative",
    "LinkedIn networking tool",
    "job seeker email finder",
    "career networking assistant",
    "safe LinkedIn tool",
    "email outreach templates",
    "hiring manager emails",
    "recruiter email finder",
    "job application referrals",
  ],
  authors: [{ name: "Ellyn" }],
  openGraph: {
    title: "Ellyn - Get Referrals & Land Interviews 3x Faster | Free LinkedIn Email Finder",
    description:
      "Find decision-makers' emails in 10 seconds. Get proven outreach templates. Track your networking. 2,000+ job seekers landed interviews using Ellyn. 100% free forever, zero ban risk.",
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
