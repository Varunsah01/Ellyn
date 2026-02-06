export interface AnalyticsOverview {
  totalContacts: { current: number; previous: number };
  emailsSent: { current: number; previous: number };
  responseRate: { current: number; previous: number };
  activeSequences: { current: number; previous: number };
  newReplies: { current: number; previous: number };
  openRate: { current: number; previous: number };
}

export interface TimeSeriesPoint {
  date: string;
  contactsAdded: number;
  emailsSent: number;
  repliesReceived: number;
}

export interface SequencePerformance {
  id: string;
  name: string;
  contactsEnrolled: number;
  emailsSent: number;
  openRate: number;
  replyRate: number;
  avgResponseTime: number; // hours
}

export interface TemplatePerformance {
  id: string;
  name: string;
  sendCount: number;
  openRate: number;
  replyRate: number;
}

export interface ContactSource {
  source: string;
  count: number;
  percentage: number;
}

export interface ResponseTimeDistribution {
  bucket: string;
  count: number;
}

export interface HeatMapData {
  row: number;
  col: number;
  value: number;
}

export interface CompanyAnalytics {
  company: string;
  contactsReached: number;
  responseRate: number;
  avgResponseTime: number;
}

// Mock data
export const mockAnalyticsOverview: AnalyticsOverview = {
  totalContacts: { current: 247, previous: 198 },
  emailsSent: { current: 892, previous: 743 },
  responseRate: { current: 34.2, previous: 31.8 },
  activeSequences: { current: 12, previous: 9 },
  newReplies: { current: 45, previous: 38 },
  openRate: { current: 58.3, previous: 54.1 },
};

export const mockTimeSeriesData: TimeSeriesPoint[] = [
  { date: "Jan 1", contactsAdded: 12, emailsSent: 45, repliesReceived: 8 },
  { date: "Jan 2", contactsAdded: 15, emailsSent: 52, repliesReceived: 12 },
  { date: "Jan 3", contactsAdded: 18, emailsSent: 61, repliesReceived: 15 },
  { date: "Jan 4", contactsAdded: 22, emailsSent: 58, repliesReceived: 18 },
  { date: "Jan 5", contactsAdded: 19, emailsSent: 64, repliesReceived: 21 },
  { date: "Jan 6", contactsAdded: 25, emailsSent: 72, repliesReceived: 24 },
  { date: "Jan 7", contactsAdded: 28, emailsSent: 78, repliesReceived: 27 },
  { date: "Jan 8", contactsAdded: 24, emailsSent: 69, repliesReceived: 23 },
  { date: "Jan 9", contactsAdded: 30, emailsSent: 85, repliesReceived: 29 },
  { date: "Jan 10", contactsAdded: 27, emailsSent: 81, repliesReceived: 32 },
  { date: "Jan 11", contactsAdded: 32, emailsSent: 92, repliesReceived: 35 },
  { date: "Jan 12", contactsAdded: 29, emailsSent: 88, repliesReceived: 31 },
  { date: "Jan 13", contactsAdded: 35, emailsSent: 96, repliesReceived: 38 },
  { date: "Jan 14", contactsAdded: 31, emailsSent: 91, repliesReceived: 34 },
];

export const mockFunnelData = [
  { label: "Emails Sent", value: 892 },
  { label: "Delivered", value: 875 },
  { label: "Opened", value: 520 },
  { label: "Clicked", value: 156 },
  { label: "Replied", value: 89 },
];

export const mockSequencePerformance: SequencePerformance[] = [
  {
    id: "1",
    name: "Software Engineer Outreach Q1 2024",
    contactsEnrolled: 45,
    emailsSent: 135,
    openRate: 62.3,
    replyRate: 28.5,
    avgResponseTime: 18,
  },
  {
    id: "2",
    name: "Product Manager Referral Requests",
    contactsEnrolled: 12,
    emailsSent: 24,
    openRate: 71.2,
    replyRate: 45.8,
    avgResponseTime: 12,
  },
  {
    id: "3",
    name: "Design Role Cold Outreach",
    contactsEnrolled: 8,
    emailsSent: 8,
    openRate: 50.0,
    replyRate: 12.5,
    avgResponseTime: 36,
  },
  {
    id: "4",
    name: "Data Science Opportunities",
    contactsEnrolled: 22,
    emailsSent: 66,
    openRate: 55.8,
    replyRate: 22.3,
    avgResponseTime: 24,
  },
  {
    id: "5",
    name: "Alumni Network Outreach",
    contactsEnrolled: 18,
    emailsSent: 54,
    openRate: 68.4,
    replyRate: 35.2,
    avgResponseTime: 14,
  },
];

export const mockTemplatePerformance: TemplatePerformance[] = [
  {
    id: "1",
    name: "Software Engineer Cold Outreach",
    sendCount: 142,
    openRate: 61.2,
    replyRate: 28.9,
  },
  {
    id: "2",
    name: "Referral Request",
    sendCount: 87,
    openRate: 73.5,
    replyRate: 42.1,
  },
  {
    id: "3",
    name: "Follow-up After No Response",
    sendCount: 125,
    openRate: 52.8,
    replyRate: 18.4,
  },
  {
    id: "4",
    name: "Thank You After Interview",
    sendCount: 34,
    openRate: 88.2,
    replyRate: 64.7,
  },
  {
    id: "5",
    name: "Alumni Outreach",
    sendCount: 68,
    openRate: 69.1,
    replyRate: 36.8,
  },
];

export const mockContactSources: ContactSource[] = [
  { source: "LinkedIn", count: 142, percentage: 57.5 },
  { source: "Manual Entry", count: 58, percentage: 23.5 },
  { source: "CSV Import", count: 32, percentage: 13.0 },
  { source: "Chrome Extension", count: 15, percentage: 6.0 },
];

export const mockResponseTimeDistribution: ResponseTimeDistribution[] = [
  { bucket: "< 1hr", count: 8 },
  { bucket: "1-4hrs", count: 15 },
  { bucket: "4-24hrs", count: 28 },
  { bucket: "1-3 days", count: 22 },
  { bucket: "3-7 days", count: 12 },
  { bucket: "> 7 days", count: 4 },
];

// Heat map data: Days of week (rows) vs Hours of day (columns)
// Days: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
// Hours: 0-23
export const mockBestSendTimesData: HeatMapData[] = [
  // Monday
  { row: 0, col: 0, value: 12 }, // 9 AM
  { row: 0, col: 1, value: 18 }, // 10 AM
  { row: 0, col: 2, value: 25 }, // 11 AM
  { row: 0, col: 3, value: 22 }, // 12 PM
  { row: 0, col: 4, value: 15 }, // 1 PM
  { row: 0, col: 5, value: 20 }, // 2 PM
  { row: 0, col: 6, value: 16 }, // 3 PM
  { row: 0, col: 7, value: 10 }, // 4 PM

  // Tuesday
  { row: 1, col: 0, value: 15 },
  { row: 1, col: 1, value: 28 },
  { row: 1, col: 2, value: 32 },
  { row: 1, col: 3, value: 29 },
  { row: 1, col: 4, value: 24 },
  { row: 1, col: 5, value: 26 },
  { row: 1, col: 6, value: 18 },
  { row: 1, col: 7, value: 12 },

  // Wednesday
  { row: 2, col: 0, value: 18 },
  { row: 2, col: 1, value: 30 },
  { row: 2, col: 2, value: 35 },
  { row: 2, col: 3, value: 31 },
  { row: 2, col: 4, value: 26 },
  { row: 2, col: 5, value: 28 },
  { row: 2, col: 6, value: 20 },
  { row: 2, col: 7, value: 14 },

  // Thursday
  { row: 3, col: 0, value: 16 },
  { row: 3, col: 1, value: 27 },
  { row: 3, col: 2, value: 33 },
  { row: 3, col: 3, value: 28 },
  { row: 3, col: 4, value: 23 },
  { row: 3, col: 5, value: 25 },
  { row: 3, col: 6, value: 19 },
  { row: 3, col: 7, value: 11 },

  // Friday
  { row: 4, col: 0, value: 14 },
  { row: 4, col: 1, value: 22 },
  { row: 4, col: 2, value: 28 },
  { row: 4, col: 3, value: 24 },
  { row: 4, col: 4, value: 18 },
  { row: 4, col: 5, value: 15 },
  { row: 4, col: 6, value: 12 },
  { row: 4, col: 7, value: 8 },

  // Saturday
  { row: 5, col: 0, value: 5 },
  { row: 5, col: 1, value: 8 },
  { row: 5, col: 2, value: 10 },
  { row: 5, col: 3, value: 9 },
  { row: 5, col: 4, value: 6 },
  { row: 5, col: 5, value: 7 },
  { row: 5, col: 6, value: 5 },
  { row: 5, col: 7, value: 3 },

  // Sunday
  { row: 6, col: 0, value: 4 },
  { row: 6, col: 1, value: 6 },
  { row: 6, col: 2, value: 8 },
  { row: 6, col: 3, value: 7 },
  { row: 6, col: 4, value: 5 },
  { row: 6, col: 5, value: 6 },
  { row: 6, col: 6, value: 4 },
  { row: 6, col: 7, value: 2 },
];

export const mockCompanyAnalytics: CompanyAnalytics[] = [
  {
    company: "Google",
    contactsReached: 42,
    responseRate: 38.1,
    avgResponseTime: 16,
  },
  {
    company: "Meta",
    contactsReached: 28,
    responseRate: 42.9,
    avgResponseTime: 14,
  },
  {
    company: "Microsoft",
    contactsReached: 35,
    responseRate: 34.3,
    avgResponseTime: 20,
  },
  {
    company: "Apple",
    contactsReached: 24,
    responseRate: 29.2,
    avgResponseTime: 24,
  },
  {
    company: "Amazon",
    contactsReached: 31,
    responseRate: 35.5,
    avgResponseTime: 18,
  },
  {
    company: "Netflix",
    contactsReached: 18,
    responseRate: 44.4,
    avgResponseTime: 12,
  },
  {
    company: "Salesforce",
    contactsReached: 22,
    responseRate: 36.4,
    avgResponseTime: 15,
  },
  {
    company: "Uber",
    contactsReached: 16,
    responseRate: 31.3,
    avgResponseTime: 22,
  },
];
