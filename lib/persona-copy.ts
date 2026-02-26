export type Persona = 'job_seeker' | 'smb_sales'

export type PersonaCopy = {
  contacts: string
  contactSingular: string
  sequences: string
  pipeline: string
  templateCategory: string
  addContact: string
  emptyContacts: string
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
  }
}
