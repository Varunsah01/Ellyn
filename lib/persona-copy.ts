export type Persona = "job_seeker" | "smb_sales";

export type PersonaCopy = {
  contacts: string;
  contactSingular: string;
  sequences: string;
  pipeline: string;
  templateCategory: string;
  addContact: string;
  emptyContacts: string;
  // Dashboard-specific copy
  dashboardSubtitle: string;
  statsContactsLabel: string;
  statsDiscoveredLabel: string;
  statsTemplatesLabel: string;
  statsEmailsLabel: string;
  statsRepliesLabel: string;
  statsReplyRateLabel: string;
  weeklyProgressEmpty: string;
  extensionCTA: string;
  nextStepContactsTitle: string;
  nextStepContactsDesc: string;
  nextStepContactsCTA: string;
  nextStepTemplatesTitle: string;
  nextStepTemplatesDesc: string;
  nextStepTemplatesCTA: string;
  addContactCTA: string;
  statsContactsEmptyMessage: string;
  statsDiscoveredEmptyMessage: string;
  statsTemplatesEmptyMessage: string;
  statsEmailsNoDataLabel: string;
  statsEmailsEmptyMessage: string;
  quickActionsTitle: string;
  quickActionFindEmail: string;
  quickActionFindEmailDesc: string;
  quickActionBrowseTemplates: string;
  quickActionBrowseTemplatesDesc: string;
  quickActionStartSequence: string;
  quickActionStartSequenceDesc: string;
  quickActionTemplatesHref: string;
  quickActionSequenceIcon: "mail" | "rocket";
  personaBannerText: string;
  // Sidebar toggle label
  personaLabel: string;
};

export function getPersonaCopy(persona: Persona): PersonaCopy {
  if (persona === "smb_sales") {
    return {
      contacts: "Leads",
      contactSingular: "Lead",
      sequences: "Sales Sequences",
      pipeline: "Deal Pipeline",
      templateCategory: "Sales Outreach",
      addContact: "Save Lead",
      emptyContacts: "No leads yet",
      dashboardSubtitle: "Your sales pipeline at a glance",
      statsContactsLabel: "Total Leads",
      statsDiscoveredLabel: "Discovered Leads",
      statsTemplatesLabel: "Email Templates",
      statsEmailsLabel: "Emails Sent",
      statsRepliesLabel: "Replies",
      statsReplyRateLabel: "Reply Rate",
      weeklyProgressEmpty: "Start by adding leads from LinkedIn.",
      extensionCTA:
        "Visit any LinkedIn profile and click the Ellyn extension to capture leads instantly.",
      nextStepContactsTitle: "Add your first contacts",
      nextStepContactsDesc: "Build a contact base from LinkedIn profiles.",
      nextStepContactsCTA: "Go to Contacts",
      nextStepTemplatesTitle: "Create reusable templates",
      nextStepTemplatesDesc: "Save outreach templates so sending is faster.",
      nextStepTemplatesCTA: "Manage Templates",
      addContactCTA: "Save Lead",
      statsContactsEmptyMessage: "Save leads via the Chrome extension",
      statsDiscoveredEmptyMessage: "Discover leads via the extension",
      statsTemplatesEmptyMessage: "Create your first sales template",
      statsEmailsNoDataLabel: "No data yet",
      statsEmailsEmptyMessage: "No sales emails sent yet",
      quickActionsTitle: "Sales Quick Actions",
      quickActionFindEmail: "Find Lead Email",
      quickActionFindEmailDesc: "Find and save verified lead emails fast.",
      quickActionBrowseTemplates: "Browse Sales Templates",
      quickActionBrowseTemplatesDesc: "Use ready-made outreach and follow-up templates.",
      quickActionStartSequence: "Launch Sales Sequence",
      quickActionStartSequenceDesc: "Start a multi-step outbound sales campaign.",
      quickActionTemplatesHref: "/dashboard/templates?category=sales_outreach",
      quickActionSequenceIcon: "rocket",
      personaBannerText: "Enterprise Mode - showing sales tools & templates",
      personaLabel: "Enterprise",
    };
  }

  return {
    contacts: "Contacts",
    contactSingular: "Contact",
    sequences: "Job Search Sequences",
    pipeline: "Application Tracker",
    templateCategory: "Job Search",
    addContact: "Save Profile",
    emptyContacts: "No saved profiles yet",
    dashboardSubtitle: "Your job search at a glance",
    statsContactsLabel: "Saved Profiles",
    statsDiscoveredLabel: "Companies Tracked",
    statsTemplatesLabel: "Cover Letters",
    statsEmailsLabel: "Emails Sent",
    statsRepliesLabel: "Replies Received",
    statsReplyRateLabel: "Success Rate",
    weeklyProgressEmpty: "Start by finding contacts at your target companies.",
    extensionCTA:
      "Visit any LinkedIn profile and save contacts at your target companies.",
    nextStepContactsTitle: "Save your first profiles",
    nextStepContactsDesc: "Build a list of hiring managers and recruiters.",
    nextStepContactsCTA: "Go to Contacts",
    nextStepTemplatesTitle: "Create outreach templates",
    nextStepTemplatesDesc: "Save cold email templates for job search.",
    nextStepTemplatesCTA: "Manage Templates",
    addContactCTA: "Save Profile",
    statsContactsEmptyMessage: "Save profiles via the Chrome extension",
    statsDiscoveredEmptyMessage: "Discover companies and contacts via the extension",
    statsTemplatesEmptyMessage: "Create your first job search template",
    statsEmailsNoDataLabel: "No data yet",
    statsEmailsEmptyMessage: "No outreach sent yet",
    quickActionsTitle: "Job Search Quick Actions",
    quickActionFindEmail: "Find Hiring Manager Email",
    quickActionFindEmailDesc: "Research contacts and save recruiter emails quickly.",
    quickActionBrowseTemplates: "Browse Job Search Templates",
    quickActionBrowseTemplatesDesc:
      "Open job search, networking, and follow-up templates.",
    quickActionStartSequence: "Start Follow-Up Sequence",
    quickActionStartSequenceDesc: "Launch a multi-step job search follow-up sequence.",
    quickActionTemplatesHref: "/dashboard/templates?category=job_search",
    quickActionSequenceIcon: "mail",
    personaBannerText: "Job Seeker Mode - showing job search tools & templates",
    personaLabel: "Job Seeker",
  };
}
