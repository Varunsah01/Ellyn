type SystemTemplate = {
  user_id: null
  is_system: true
  is_default: false
  name: string
  subject: string
  body: string
  tone: 'professional' | 'casual' | 'formal' | 'friendly'
  use_case: string
  category: 'job_seeker' | 'smb_sales'
  variables: string[]
  usage_count: number
  use_count: number
}

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Cold Outreach to Hiring Manager',
    subject: 'Quick question about {{role}} opportunities at {{company}}',
    body: `Hi {{first_name}},

I came across your profile on LinkedIn and noticed you lead {{department}} at {{company}}. I have been following {{company}} and was impressed by {{company_achievement}}.

I would love a short 15-minute conversation to understand what you look for in candidates with {{target_field}} experience.

Would you be open to that this week?

Best,
{{sender_name}}`,
    tone: 'professional',
    use_case: 'cold_outreach',
    category: 'job_seeker',
    variables: [
      'first_name',
      'role',
      'company',
      'department',
      'company_achievement',
      'target_field',
      'sender_name',
    ],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Informational Interview Request',
    subject: 'Would love to learn from your experience at {{company}}',
    body: `Hi {{first_name}},

Your career path caught my eye, especially your work in {{their_specialty}} at {{company}}. I am exploring a move into {{target_field}} and would value 20 minutes of your advice.

No pitch, just genuine curiosity.

Would you be open to a quick chat in the next few weeks?

Thank you,
{{sender_name}}`,
    tone: 'friendly',
    use_case: 'informational_interview',
    category: 'job_seeker',
    variables: ['first_name', 'company', 'their_specialty', 'target_field', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Recruiter Introduction',
    subject: 'Experienced {{role}} open to new opportunities',
    body: `Hi {{first_name}},

I noticed you work with {{role}} hiring in {{target_field}} and wanted to reach out directly.

I have hands-on experience in {{target_field}} and I am currently exploring new roles. If useful, I can share a short summary of my background.

Would you be open to connecting?

Best,
{{sender_name}}`,
    tone: 'professional',
    use_case: 'recruiter_outreach',
    category: 'job_seeker',
    variables: ['first_name', 'role', 'target_field', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Post-Application Follow-Up',
    subject: 'Following up on my {{role}} application at {{company}}',
    body: `Hi {{first_name}},

I applied for the {{role}} position at {{company}} and wanted to follow up briefly.

I am genuinely excited about the team and believe my background in {{target_field}} aligns well with what you are building.

Is there anything additional I can provide?

Thanks for your time,
{{sender_name}}`,
    tone: 'professional',
    use_case: 'follow_up',
    category: 'job_seeker',
    variables: ['first_name', 'role', 'company', 'target_field', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Referral Request (Mutual Connection)',
    subject: '{{sender_name}} - referral request for {{company}}',
    body: `Hi {{first_name}},

I was encouraged by a mutual connection to reach out about opportunities in {{target_field}} at {{company}}.

I am very interested in your team and would appreciate any guidance on the best way to position my profile.

If you are open to it, I would be grateful for a referral or brief advice.

Thanks in advance,
{{sender_name}}`,
    tone: 'friendly',
    use_case: 'referral_request',
    category: 'job_seeker',
    variables: ['first_name', 'sender_name', 'company', 'target_field'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Thank You After Informational Chat',
    subject: 'Thank you for your time, {{first_name}}',
    body: `Hi {{first_name}},

Thank you again for taking the time to speak with me. Your insights about {{company}} and {{target_field}} were incredibly helpful.

I especially appreciated your point about {{their_specialty}} and I am already applying that advice.

I would love to stay in touch.

Best,
{{sender_name}}`,
    tone: 'friendly',
    use_case: 'thank_you',
    category: 'job_seeker',
    variables: ['first_name', 'company', 'target_field', 'their_specialty', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Re-Engagement After No Response',
    subject: 'Still interested in opportunities at {{company}}',
    body: `Hi {{first_name}},

I know schedules get busy, so I wanted to follow up once more.

I am still very interested in opportunities at {{company}}, especially around {{target_field}}.

If timing is not right, no worries at all. If it is, I would appreciate a short conversation.

Best,
{{sender_name}}`,
    tone: 'casual',
    use_case: 're_engagement',
    category: 'job_seeker',
    variables: ['first_name', 'company', 'target_field', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Open to Work - Direct Pitch',
    subject: '{{role}} with {{target_field}} experience open to new roles',
    body: `Hi {{first_name}},

I am a {{role}} with strong experience in {{target_field}}, and I am currently exploring my next opportunity.

I have been following {{company}} and believe I could contribute quickly.

Would you be open to a short exploratory conversation?

Best,
{{sender_name}}`,
    tone: 'professional',
    use_case: 'direct_pitch',
    category: 'job_seeker',
    variables: ['first_name', 'role', 'target_field', 'company', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Cold Intro - Pain Point Hook',
    subject: 'Quick question about {{pain_point}} at {{company}}',
    body: `Hi {{first_name}},

I work with {{role}} teams at companies like {{company}} that are dealing with {{pain_point}}.

We typically help them {{benefit}} while keeping implementation lightweight.

Would a 15-minute call be worth exploring?

{{sender_name}}
{{your_company}}`,
    tone: 'professional',
    use_case: 'cold_intro',
    category: 'smb_sales',
    variables: ['first_name', 'role', 'company', 'pain_point', 'benefit', 'sender_name', 'your_company'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Case Study Share',
    subject: 'How similar teams solved {{pain_point}} in 30 days',
    body: `Hi {{first_name}},

Thought this might be relevant: a team similar to {{company}} recently improved outcomes around {{pain_point}} using {{your_company}}.

Results in 30 days:
- [Result 1]
- [Result 2]
- [Result 3]

Happy to share details if helpful.

{{sender_name}}`,
    tone: 'professional',
    use_case: 'social_proof',
    category: 'smb_sales',
    variables: ['first_name', 'company', 'pain_point', 'your_company', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Meeting Request',
    subject: '15 minutes to discuss {{benefit}} for {{company}}?',
    body: `Hi {{first_name}},

I believe {{your_company}} could help {{company}} {{benefit}}.

If useful, I can walk you through a practical approach in 15 minutes.

Would [day] or [day] next week work?

{{sender_name}}`,
    tone: 'professional',
    use_case: 'meeting_request',
    category: 'smb_sales',
    variables: ['first_name', 'company', 'your_company', 'benefit', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Follow-Up #1 (Soft)',
    subject: 'Re: {{benefit}} for {{company}}',
    body: `Hi {{first_name}},

Quick bump in case this got buried.

I still think there could be a strong fit for helping {{company}} {{benefit}}. Happy to keep it brief or async if easier.

Open to exploring?

{{sender_name}}`,
    tone: 'friendly',
    use_case: 'follow_up_1',
    category: 'smb_sales',
    variables: ['first_name', 'company', 'benefit', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Follow-Up #2 (Value Add)',
    subject: 'Useful resource for {{company}}',
    body: `Hi {{first_name}},

Instead of just following up, I wanted to share something practical related to {{pain_point}}.

[Resource or insight summary]

If helpful, I can also show how teams use {{your_company}} to {{benefit}}.

{{sender_name}}`,
    tone: 'professional',
    use_case: 'follow_up_2',
    category: 'smb_sales',
    variables: ['first_name', 'company', 'pain_point', 'your_company', 'benefit', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Breakup Email',
    subject: 'Closing the loop for {{company}}',
    body: `Hi {{first_name}},

I have reached out a few times and have not heard back, so I will close the loop for now.

If {{pain_point}} becomes a priority later, I am happy to reconnect and share ideas.

Wishing {{company}} continued success.

{{sender_name}}`,
    tone: 'casual',
    use_case: 'breakup',
    category: 'smb_sales',
    variables: ['first_name', 'company', 'pain_point', 'sender_name'],
    usage_count: 0,
    use_count: 0,
  },
  {
    user_id: null,
    is_system: true,
    is_default: false,
    name: 'Referral from Mutual Connection',
    subject: '{{sender_name}} suggested we connect',
    body: `Hi {{first_name}},

I was referred to you and wanted to reach out directly.

We have helped teams like {{company}} address {{pain_point}} and achieve {{benefit}} with {{your_company}}.

Would you be open to a quick conversation this or next week?

{{sender_name}}`,
    tone: 'friendly',
    use_case: 'referral',
    category: 'smb_sales',
    variables: ['first_name', 'sender_name', 'company', 'pain_point', 'benefit', 'your_company'],
    usage_count: 0,
    use_count: 0,
  },
]

export function getSystemTemplates(): SystemTemplate[] {
  return SYSTEM_TEMPLATES.map((template) => ({ ...template }))
}
