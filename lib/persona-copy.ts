export type Persona = 'job_seeker' | 'smb_sales'

export type PersonaCopy = {
  contacts: string
  contactSingular: string
  sequences: string
  pipeline: string
  templateCategory: string
  addContact: string
  emptyContacts: string
  // Dashboard-specific copy
  dashboardSubtitle: string
  statsContactsLabel: string
  statsDiscoveredLabel: string
  statsTemplatesLabel: string
  statsEmailsLabel: string
  weeklyProgressEmpty: string
  extensionCTA: string
  nextStepContactsTitle: string
  nextStepContactsDesc: string
  nextStepContactsCTA: string
  nextStepTemplatesTitle: string
  nextStepTemplatesDesc: string
  nextStepTemplatesCTA: string
  addContactCTA: string
  // Sidebar toggle label
  personaLabel: string
}

export function getPersonaCopy(persona: Persona): PersonaCopy {
  if (persona === 'smb_sales') {
    return {
      contacts: 'Leads',
      contactSingular: 'Lead',
      sequences: 'Sales Sequences',
      pipeline: 'Deal Pipeline',
      templateCategory: 'Sales Outreach',
      addContact: 'Save Lead',
      emptyContacts: 'No leads yet',
      dashboardSubtitle: 'Your sales pipeline at a glance',
      statsContactsLabel: 'Total Leads',
      statsDiscoveredLabel: 'Discovered Leads',
      statsTemplatesLabel: 'Email Templates',
      statsEmailsLabel: 'Emails Sent',
      weeklyProgressEmpty: 'Start by adding leads from LinkedIn.',
      extensionCTA: 'Visit any LinkedIn profile and click the Ellyn extension to capture leads instantly.',
      nextStepContactsTitle: 'Add your first contacts',
      nextStepContactsDesc: 'Build a contact base from LinkedIn profiles.',
      nextStepContactsCTA: 'Go to Contacts',
      nextStepTemplatesTitle: 'Create reusable templates',
      nextStepTemplatesDesc: 'Save outreach templates so sending is faster.',
      nextStepTemplatesCTA: 'Manage Templates',
      addContactCTA: 'Add Contact',
      personaLabel: 'Enterprise',
    }
  }

  return {
    contacts: 'Contacts',
    contactSingular: 'Contact',
    sequences: 'Job Search Sequences',
    pipeline: 'Application Tracker',
    templateCategory: 'Job Search',
    addContact: 'Save Profile',
    emptyContacts: 'No saved profiles yet',
    dashboardSubtitle: 'Your job search at a glance',
    statsContactsLabel: 'Saved Profiles',
    statsDiscoveredLabel: 'Companies Tracked',
    statsTemplatesLabel: 'Cover Letters',
    statsEmailsLabel: 'Outreach Sent',
    weeklyProgressEmpty: 'Start by finding contacts at your target companies.',
    extensionCTA: 'Visit any LinkedIn profile and save contacts at your target companies.',
    nextStepContactsTitle: 'Save your first profiles',
    nextStepContactsDesc: 'Build a list of hiring managers and recruiters.',
    nextStepContactsCTA: 'Go to Contacts',
    nextStepTemplatesTitle: 'Create outreach templates',
    nextStepTemplatesDesc: 'Save cold email templates for job search.',
    nextStepTemplatesCTA: 'Manage Templates',
    addContactCTA: 'Save Profile',
    personaLabel: 'Job Seeker',
  }
}
