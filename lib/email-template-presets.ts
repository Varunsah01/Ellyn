export type EmailTemplatePreset = {
  id: string
  name: string
  description: string
  category: 'job_search' | 'sales_outreach' | 'networking' | 'follow_up'
  tone: 'professional' | 'friendly' | 'casual' | 'formal'
  subject: string
  body: string
  variables: string[]
  tags: string[]
  icon: string
  use_case: string
}

type ApiEmailTemplateCategory = 'job_seeker' | 'smb_sales' | 'general'

type ApiEmailTemplateCreatePayload = {
  name: string
  subject: string
  body: string
  tone: EmailTemplatePreset['tone']
  use_case: string
  category: ApiEmailTemplateCategory
}

const CATEGORY_TO_API_CATEGORY: Record<
  EmailTemplatePreset['category'],
  ApiEmailTemplateCategory
> = {
  job_search: 'job_seeker',
  sales_outreach: 'smb_sales',
  networking: 'job_seeker',
  follow_up: 'general',
}

export const PRESET_CATEGORY_META: Record<
  EmailTemplatePreset['category'],
  { label: string; className: string; icon: string }
> = {
  job_search: {
    label: 'Job Search',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: '🎯',
  },
  sales_outreach: {
    label: 'Sales Outreach',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: '📈',
  },
  networking: {
    label: 'Networking',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: '🤝',
  },
  follow_up: {
    label: 'Follow-Up',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: '🔁',
  },
}

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  {
    id: 'job-networking-introduction',
    name: 'Networking Introduction',
    description: 'Reach out to someone at a target company with a clear, respectful ask.',
    category: 'job_search',
    tone: 'professional',
    subject: 'Quick intro about {{role}} opportunities at {{company}}',
    body: `Hi {{first_name}}, I have been following {{company}} and your work stood out to me. I am currently exploring {{role}} opportunities and wanted to introduce myself briefly. If you are open to it, I would value 15 minutes to hear what your team looks for in strong candidates. Thanks for considering it, and I appreciate your time. Best, {{your_name}}`,
    variables: ['first_name', 'company', 'role', 'your_name'],
    tags: ['job search', 'networking', 'cold outreach'],
    icon: '🎯',
    use_case: 'target company introduction',
  },
  {
    id: 'job-referral-request',
    name: 'Referral Request',
    description: 'Ask a mutual contact for a warm intro while making the request easy to decline.',
    category: 'job_search',
    tone: 'friendly',
    subject: 'Could you help with an intro to {{company}}?',
    body: `Hi {{first_name}}, I hope you are doing well and I wanted to ask a quick favor related to a {{role}} opening at {{company}}. I noticed you are connected to {{mutual_contact}}, and I would be grateful for an introduction if you feel comfortable. I can send a short blurb and resume to make it easy, and I completely understand if the timing is not right. Thank you either way for your help. Best, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'mutual_contact',
      'your_name',
    ],
    tags: ['job search', 'referral', 'warm intro'],
    icon: '🤝',
    use_case: 'mutual contact referral ask',
  },
  {
    id: 'job-recruiter-cold-outreach',
    name: 'Recruiter Cold Outreach',
    description: 'Proactively contact a recruiter with concise positioning and relevance.',
    category: 'job_search',
    tone: 'professional',
    subject: '{{role}} candidate interested in {{company}}',
    body: `Hi {{first_name}}, I am reaching out because I am actively exploring {{role}} opportunities and I am especially interested in {{company}}. I have been focused on {{core_skill}} and recently delivered {{achievement}}, which feels aligned with your hiring priorities. If useful, I would be glad to share my resume and a short summary to see whether there is a fit. Thank you for your time and consideration. Regards, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'core_skill',
      'achievement',
      'your_name',
    ],
    tags: ['job search', 'recruiter', 'proactive'],
    icon: '👔',
    use_case: 'proactive recruiter outreach',
  },
  {
    id: 'job-application-follow-up',
    name: 'Job Application Follow-Up',
    description: 'Follow up after applying and reinforce fit without sounding repetitive.',
    category: 'job_search',
    tone: 'formal',
    subject: 'Follow-up on my {{role}} application at {{company}}',
    body: `Hi {{first_name}}, I submitted my application for the {{role}} position at {{company}} on {{application_date}} and wanted to follow up. I remain very interested in this role and believe my experience with {{relevant_experience}} aligns well with what your team needs. If there is any additional information I can provide, I would be happy to share it promptly. Thank you for your time and consideration. Sincerely, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'application_date',
      'relevant_experience',
      'your_name',
    ],
    tags: ['job search', 'application', 'follow-up'],
    icon: '📨',
    use_case: 'post application follow-up',
  },
  {
    id: 'job-informational-interview-request',
    name: 'Informational Interview Request',
    description: 'Request a 20-minute conversation to learn from someone in the role.',
    category: 'job_search',
    tone: 'friendly',
    subject: 'Would you be open to a 20-minute chat?',
    body: `Hi {{first_name}}, I am exploring a path into {{role}} roles and your experience at {{company}} looks very relevant to what I am trying to learn. I would appreciate 20 minutes to ask a few questions about your journey and the skills your team values most. I am not asking for a job directly, only guidance so I can prepare better for opportunities like this. Thank you for considering it, and I am happy to work around your schedule. Best, {{your_name}}`,
    variables: ['first_name', 'company', 'role', 'your_name'],
    tags: ['job search', 'informational interview', 'career guidance'],
    icon: '🧭',
    use_case: 'informational interview ask',
  },
  {
    id: 'sales-cold-intro-pain-point-hook',
    name: 'Cold Intro - Pain Point Hook',
    description: 'Lead with a problem your team solves and invite a low-friction response.',
    category: 'sales_outreach',
    tone: 'professional',
    subject: 'Quick idea for {{company}} on {{pain_point}}',
    body: `Hi {{first_name}}, I work with {{role}} leaders and many tell me that {{pain_point}} is hard to fix without adding more tools. We helped teams similar to {{company}} reduce this issue and improve {{outcome_metric}} in a few weeks. If this is relevant for your priorities, I can share the approach in a short 15-minute call. Either way, thanks for taking a look. Best, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'pain_point',
      'outcome_metric',
      'your_name',
    ],
    tags: ['sales', 'cold intro', 'pain point'],
    icon: '📈',
    use_case: 'pain point led cold outreach',
  },
  {
    id: 'sales-case-study-share',
    name: 'Case Study Share',
    description: 'Share a relevant customer story before making a meeting ask.',
    category: 'sales_outreach',
    tone: 'professional',
    subject: 'Relevant case study for {{company}}',
    body: `Hi {{first_name}}, I thought this might be useful since {{company}} appears focused on {{strategic_goal}} this quarter. We recently worked with a similar team in a {{role}} function and improved {{outcome_metric}} by {{result_value}}. I can send the short case study summary or walk through what made it work in practice. If helpful, I would be glad to share details. Regards, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'strategic_goal',
      'outcome_metric',
      'result_value',
      'your_name',
    ],
    tags: ['sales', 'social proof', 'case study'],
    icon: '📊',
    use_case: 'social proof outreach',
  },
  {
    id: 'sales-meeting-request',
    name: 'Meeting Request',
    description: 'Make a direct call or demo ask with clear next-step options.',
    category: 'sales_outreach',
    tone: 'friendly',
    subject: '15 minutes next week for {{company}}?',
    body: `Hi {{first_name}}, I will keep this short because I know your schedule is full as {{role}} at {{company}}. I believe we can help with {{pain_point}} and potentially improve {{outcome_metric}} without adding process overhead. Would you be open to a brief call next week to see if this is worth exploring? If yes, I can send over two time options. Thanks, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'pain_point',
      'outcome_metric',
      'your_name',
    ],
    tags: ['sales', 'meeting ask', 'demo'],
    icon: '📅',
    use_case: 'direct meeting request',
  },
  {
    id: 'sales-breakup-email',
    name: 'Breakup Email',
    description: 'Send a final close-the-loop email when there is no response.',
    category: 'sales_outreach',
    tone: 'casual',
    subject: 'Should I close this out?',
    body: `Hi {{first_name}}, I have reached out a couple of times about helping {{company}} with {{pain_point}} and did not want to keep filling your inbox. I know priorities shift, so I will close the loop here unless this is still relevant to your {{role}} goals. If timing changes later, I am happy to reconnect and share ideas. Thanks again for reading. Best, {{your_name}}`,
    variables: ['first_name', 'company', 'role', 'pain_point', 'your_name'],
    tags: ['sales', 'breakup', 'final follow-up'],
    icon: '🛑',
    use_case: 'final no response follow-up',
  },
  {
    id: 'follow-up-gentle-nudge',
    name: 'Gentle Nudge',
    description: 'A polite check-in sent 3 to 5 days after the first message.',
    category: 'follow_up',
    tone: 'friendly',
    subject: 'Quick follow-up on my note',
    body: `Hi {{first_name}}, I wanted to gently follow up on my earlier email in case it got buried. I know things move quickly at {{company}}, especially in a {{role}} seat, so I wanted to keep this brief. If the topic is relevant, I would be glad to share a tighter summary or next step. Thanks for your time. Best, {{your_name}}`,
    variables: ['first_name', 'company', 'role', 'your_name'],
    tags: ['follow-up', 'nudge', '3-5 days'],
    icon: '🔔',
    use_case: 'soft follow-up reminder',
  },
  {
    id: 'follow-up-value-add',
    name: 'Value-Add Follow-Up',
    description: 'Share a useful resource before asking for a reply again.',
    category: 'follow_up',
    tone: 'professional',
    subject: 'Sharing something useful for {{company}}',
    body: `Hi {{first_name}}, instead of following up empty-handed, I wanted to pass along this resource on {{topic_area}} that may be helpful for your {{role}} team at {{company}}. It includes a practical framework and examples you can use right away. If you want, I can also show how other teams apply it in similar situations. Either way, I hope it is useful. Regards, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'topic_area',
      'your_name',
    ],
    tags: ['follow-up', 'value add', 'resource'],
    icon: '📎',
    use_case: 'resource based follow-up',
  },
  {
    id: 'follow-up-last-attempt',
    name: 'Last Attempt',
    description: 'Send a respectful final follow-up with a graceful exit.',
    category: 'follow_up',
    tone: 'formal',
    subject: 'Final follow-up from {{your_name}}',
    body: `Hi {{first_name}}, this will be my final follow-up so I can close the loop respectfully. I reached out because I thought there might be a strong fit around {{pain_point}} at {{company}} given your {{role}} priorities. If now is not the right time, no reply is needed and I completely understand. Thank you again for your time and consideration. Sincerely, {{your_name}}`,
    variables: [
      'first_name',
      'company',
      'role',
      'pain_point',
      'your_name',
    ],
    tags: ['follow-up', 'last attempt', 'graceful close'],
    icon: '✅',
    use_case: 'final graceful exit',
  },
]

export function presetToTemplatePayload(
  preset: EmailTemplatePreset
): ApiEmailTemplateCreatePayload {
  return {
    name: preset.name,
    subject: preset.subject,
    body: preset.body,
    tone: preset.tone,
    use_case: preset.use_case.trim().slice(0, 50),
    category: CATEGORY_TO_API_CATEGORY[preset.category],
  }
}
