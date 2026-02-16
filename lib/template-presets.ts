export type TemplateCategory =
  | 'recruiter'
  | 'referral'
  | 'advice'
  | 'follow-up'
  | 'networking'
  | 'thank-you'
  | 'startup'
  | 'custom'

export interface TemplatePreset {
  key: string
  name: string
  icon: string
  category: TemplateCategory
  tags: string[]
  subject: string
  body: string
  description: string
  useCount: number
}

export const TEMPLATE_CATEGORIES: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'referral', label: 'Referral' },
  { value: 'advice', label: 'Advice' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'networking', label: 'Networking' },
  { value: 'thank-you', label: 'Thank You' },
  { value: 'startup', label: 'Startup' },
  { value: 'custom', label: 'Custom' },
]

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    key: 'to-recruiter',
    name: 'To Recruiter',
    icon: '👔',
    category: 'recruiter',
    tags: ['recruiter', 'cold outreach', 'application'],
    subject: 'Interested in {{role}} opportunities at {{company}}',
    description: 'Professional first-touch outreach to recruiters.',
    useCount: 23,
    body: `Hi {{firstName}},

I hope you are doing well. I am exploring {{role}} opportunities at {{company}} and wanted to introduce myself.

I recently worked on projects related to [relevant skill], and I would appreciate the chance to share how my background could support your team.

If helpful, I can send my resume and a short summary of relevant work.

Best regards,
{{userFirstName}} {{userLastName}}`,
  },
  {
    key: 'referral-request',
    name: 'Referral Request',
    icon: '🤝',
    category: 'referral',
    tags: ['referral', 'employee outreach', 'network'],
    subject: 'Referral request for {{role}} at {{company}}',
    description: 'Ask employees or alumni for a referral politely.',
    useCount: 45,
    body: `Hi {{firstName}},

I came across your profile and noticed your work at {{company}}. I am applying for the {{role}} role and would be grateful for your advice.

If you feel comfortable, would you consider referring me? I can send my resume and a short note on why I am a fit.

Thanks for your time and consideration.

Best,
{{userFirstName}}`,
  },
  {
    key: 'seeking-advice',
    name: 'Seeking Advice',
    icon: '💬',
    category: 'advice',
    tags: ['informational interview', 'career advice'],
    subject: 'Would love to learn about your experience at {{company}}',
    description: 'Low-pressure informational outreach for guidance.',
    useCount: 12,
    body: `Hi {{firstName}},

I am currently exploring roles in this space and found your profile while researching {{company}}.

If you are open to it, I would value 15 minutes to hear about your experience as a {{role}} and any advice for someone entering this path.

Thank you for considering.

Best regards,
{{userFirstName}}`,
  },
  {
    key: 'ai-generated',
    name: 'AI Generated',
    icon: '✨',
    category: 'custom',
    tags: ['ai', 'custom', 'adaptive'],
    subject: 'Quick introduction regarding {{company}}',
    description: 'Use AI assistant to generate from scratch.',
    useCount: 8,
    body: `Hi {{firstName}},

I am reaching out because I am excited about the work happening at {{company}}.

[Use AI Assistant to generate a fully tailored message for this contact.]

Best,
{{userFirstName}}`,
  },
  {
    key: 'follow-up',
    name: 'Follow-Up',
    icon: '📧',
    category: 'follow-up',
    tags: ['follow-up', 'application status'],
    subject: 'Following up on my application for {{role}}',
    description: 'Polite follow-up after an application or first message.',
    useCount: 5,
    body: `Hi {{firstName}},

I wanted to follow up on my previous note regarding the {{role}} position at {{company}}.

I remain very interested and would appreciate any update when convenient.

Thank you for your time.

Best,
{{userFirstName}}`,
  },
  {
    key: 'alumni-connection',
    name: 'Alumni Connection',
    icon: '🎓',
    category: 'networking',
    tags: ['alumni', 'networking', 'warm outreach'],
    subject: 'Fellow {{userSchool}} alum working at {{company}}',
    description: 'Leverage shared school background to start conversations.',
    useCount: 2,
    body: `Hi {{firstName}},

I noticed we both attended {{userSchool}} and that you are now at {{company}}.

I am exploring similar career paths and would appreciate any advice from your experience.

If you have 15 minutes for a quick chat, I would be very grateful.

Thanks,
{{userFirstName}}`,
  },
  {
    key: 'thank-you',
    name: 'Thank You',
    icon: '🌟',
    category: 'thank-you',
    tags: ['gratitude', 'post-interview'],
    subject: 'Thank you for your time',
    description: 'Concise and professional thank-you follow-up.',
    useCount: 1,
    body: `Hi {{firstName}},

Thank you for taking the time to speak with me.

I enjoyed learning about your team at {{company}} and appreciate your guidance.

Thanks again for your time.

Best regards,
{{userFirstName}}`,
  },
  {
    key: 'startup-outreach',
    name: 'Startup Outreach',
    icon: '🚀',
    category: 'startup',
    tags: ['startup', 'mission', 'enthusiastic'],
    subject: 'Excited about {{company}}\'s mission',
    description: 'Mission-focused outreach to startup teams.',
    useCount: 4,
    body: `Hi {{firstName}},

I have been following {{company}} and am genuinely excited by your mission.

I am drawn to fast-moving teams and would love to contribute in a {{role}} capacity.

If useful, I would be happy to share relevant work and discuss how I can add value.

Best,
{{userFirstName}}`,
  },
]

export const TEMPLATE_ICONS = ['👔', '🤝', '💬', '✨', '📧', '🎓', '🌟', '🚀', '🧠', '📌', '📣', '📝']
