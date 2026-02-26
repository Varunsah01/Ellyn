/**
 * System template seed — run manually via an admin script:
 *   import { seedSystemTemplates } from '@/lib/db/seed-templates'
 *   await seedSystemTemplates(supabaseServiceRoleClient)
 *
 * These templates are is_system=true and shared across all users (user_id = null or a system UUID).
 * Do NOT run automatically on startup.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type SeedTemplate = {
  name: string
  subject: string
  body: string
  use_case: string
  tone: string
  category: 'job_seeker' | 'smb_sales'
  is_system: true
  is_default: boolean
  variables: string[]
}

const JOB_SEEKER_TEMPLATES: SeedTemplate[] = [
  {
    name: 'Cold Outreach to Hiring Manager',
    use_case: 'cold_outreach',
    tone: 'professional',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Quick question about {{role}} opportunities at {{company}}',
    body: `Hi {{first_name}},

I came across your profile on LinkedIn and noticed you lead {{department}} at {{company}}. I've been following {{company}}'s work on {{company_achievement}} and would love to explore whether there's a fit for someone with my background in {{your_skill}}.

I'm not looking to apply blindly through the portal — I'd genuinely love a 15-minute conversation to understand what you're looking for in this role.

Would that be possible this week?

Best,
{{sender_name}}`,
    variables: ['first_name', 'role', 'company', 'department', 'company_achievement', 'your_skill', 'sender_name'],
  },
  {
    name: 'Informational Interview Request',
    use_case: 'informational_interview',
    tone: 'friendly',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Would love to learn from your experience at {{company}}',
    body: `Hi {{first_name}},

Your career path caught my eye — particularly your work in {{their_specialty}} at {{company}}. I'm exploring a transition into {{target_field}} and would really value 20 minutes of your time.

No agenda, no sales pitch — I'm genuinely curious about how you got where you are and what you wish you'd known earlier.

Would you be open to a brief chat sometime in the next few weeks?

Thank you so much,
{{sender_name}}`,
    variables: ['first_name', 'company', 'their_specialty', 'target_field', 'sender_name'],
  },
  {
    name: 'Recruiter Introduction',
    use_case: 'recruiter_outreach',
    tone: 'professional',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Experienced {{role}} open to new opportunities',
    body: `Hi {{first_name}},

I noticed you specialize in placing {{role}} candidates in {{target_field}} and wanted to reach out directly.

I have {{your_skill}} experience and I'm currently exploring new opportunities. My background includes [a quick achievement], and I'm particularly interested in roles at companies focused on [area of interest].

I'd love to connect and share my background if you think it might be a fit for any of your current searches.

Best,
{{sender_name}}`,
    variables: ['first_name', 'role', 'target_field', 'your_skill', 'sender_name'],
  },
  {
    name: 'Post-Application Follow-Up',
    use_case: 'follow_up',
    tone: 'professional',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Following up — {{role}} application at {{company}}',
    body: `Hi {{first_name}},

I applied for the {{role}} position at {{company}} about a week ago and wanted to follow up briefly to reiterate my interest.

I'm genuinely excited about what {{company}} is building, especially [specific thing about the company/team]. I believe my background in {{your_skill}} would allow me to contribute quickly.

Is there anything additional I can provide to support my application?

Thanks so much for your time,
{{sender_name}}`,
    variables: ['first_name', 'role', 'company', 'your_skill', 'sender_name'],
  },
  {
    name: 'Referral Request (Mutual Connection)',
    use_case: 'referral',
    tone: 'friendly',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: '{{mutual_connection}} suggested I reach out',
    body: `Hi {{first_name}},

{{mutual_connection}} suggested I get in touch — they thought you might be a great person to speak with as I'm exploring roles in {{target_field}} at {{company}}.

I've been following {{company}}'s work closely and am genuinely interested in [specific team or product]. I'd love to ask you a few questions about your experience there and whether you'd be comfortable passing along my profile to the hiring team.

I know this is a big ask from a stranger — happy to return the favour any way I can!

Thanks in advance,
{{sender_name}}`,
    variables: ['first_name', 'mutual_connection', 'target_field', 'company', 'sender_name'],
  },
  {
    name: 'Thank You After Informational Chat',
    use_case: 'thank_you',
    tone: 'warm',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Great chatting with you, {{first_name}}',
    body: `Hi {{first_name}},

Thank you so much for taking the time to speak with me today. I really appreciated your candid insights about {{company}} and your advice on navigating {{target_field}}.

The suggestion you gave about [specific advice] was especially helpful — I'm going to put that into practice immediately.

I'd love to stay in touch as I continue exploring this path. And please don't hesitate to reach out if there's ever anything I can help with on my end.

Thanks again,
{{sender_name}}`,
    variables: ['first_name', 'company', 'target_field', 'sender_name'],
  },
  {
    name: 'Re-Engagement After Ghosting',
    use_case: 're_engagement',
    tone: 'confident',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: 'Still very interested in {{company}}',
    body: `Hi {{first_name}},

I know you're busy, so I'll be brief — I'm still very interested in joining {{company}} and didn't want my earlier message to get lost.

Since we last spoke, I've [brief update — something relevant], which only reinforced why I think this role is a great fit.

If the timing isn't right, no worries at all. But if you have 10 minutes, I'd love to pick up where we left off.

Best,
{{sender_name}}`,
    variables: ['first_name', 'company', 'sender_name'],
  },
  {
    name: 'Open to Work — Direct Pitch',
    use_case: 'direct_pitch',
    tone: 'confident',
    category: 'job_seeker',
    is_system: true,
    is_default: false,
    subject: '{{role}} with {{your_skill}} background — open to new challenges',
    body: `Hi {{first_name}},

I'm a {{role}} with deep expertise in {{your_skill}}, and I'm currently exploring my next opportunity.

What I bring:
• [Key achievement #1 — quantified if possible]
• [Key achievement #2]
• [Key achievement #3]

I've been following {{company}}'s trajectory and believe I could add immediate value to your team.

Would you be open to a 15-minute exploratory conversation?

Best,
{{sender_name}}`,
    variables: ['first_name', 'role', 'your_skill', 'company', 'sender_name'],
  },
]

const SMB_SALES_TEMPLATES: SeedTemplate[] = [
  {
    name: 'Cold Intro — Pain Point Hook',
    use_case: 'cold_intro',
    tone: 'professional',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: 'Quick question about {{pain_point}} at {{company}}',
    body: `Hi {{first_name}},

I work with {{role}}s at companies like {{company}} who are dealing with {{pain_point}}.

Most of them tell me [describe the frustrating status quo]. We help them {{benefit}} — without [the usual downside/trade-off].

Worth a quick 15-minute call to see if there's a fit?

{{sender_name}}
{{your_company}}`,
    variables: ['first_name', 'role', 'company', 'pain_point', 'benefit', 'sender_name', 'your_company'],
  },
  {
    name: 'Case Study Share',
    use_case: 'social_proof',
    tone: 'professional',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: 'How [Client] solved {{pain_point}} in 30 days',
    body: `Hi {{first_name}},

I thought you might find this relevant — a {{role}} at a company similar to {{company}} recently faced the same {{pain_point}} challenge you might be dealing with.

Here's what they achieved in 30 days using {{your_company}}:
• [Result 1 — quantified]
• [Result 2 — quantified]
• [Result 3 — qualitative outcome]

Happy to share the full case study or walk you through how we might replicate these results for {{company}}.

{{sender_name}}`,
    variables: ['first_name', 'role', 'company', 'pain_point', 'your_company', 'sender_name'],
  },
  {
    name: 'Meeting Request',
    use_case: 'meeting_request',
    tone: 'professional',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: '15 minutes — {{benefit}} for {{company}}?',
    body: `Hi {{first_name}},

I'll keep this brief — I believe {{your_company}} could help {{company}} {{benefit}}.

I'd love 15 minutes to show you exactly how, or at minimum, get your feedback on whether this is even relevant.

Are you free [day] or [day] next week?

{{sender_name}}`,
    variables: ['first_name', 'company', 'your_company', 'benefit', 'sender_name'],
  },
  {
    name: 'Follow-Up #1 (Soft)',
    use_case: 'follow_up_1',
    tone: 'friendly',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: 'Re: {{benefit}} for {{company}}',
    body: `Hi {{first_name}},

Just wanted to bump this up — I know things get busy.

Still think there's something worth exploring here for {{company}}. Happy to be flexible on format — even a 10-minute async video call or a quick voice note exchange works for me.

What do you think?

{{sender_name}}`,
    variables: ['first_name', 'company', 'benefit', 'sender_name'],
  },
  {
    name: 'Follow-Up #2 (Value Add)',
    use_case: 'follow_up_2',
    tone: 'professional',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: 'Something useful for {{company}}',
    body: `Hi {{first_name}},

Rather than following up empty-handed, I wanted to share [a useful resource, stat, or insight relevant to their industry] that might be helpful regardless of whether we work together.

[1–2 sentence description of the resource and why it's relevant to their specific situation at {{company}}.]

Let me know if you'd like to chat about how {{your_company}} fits into this — or just take the resource for free.

Either way, hope it helps.

{{sender_name}}`,
    variables: ['first_name', 'company', 'your_company', 'sender_name'],
  },
  {
    name: 'Breakup Email',
    use_case: 'breakup',
    tone: 'confident',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: 'Closing the loop — {{company}}',
    body: `Hi {{first_name}},

I've reached out a few times and haven't heard back, so I'll assume the timing isn't right and close out my outreach.

If {{pain_point}} becomes a priority again down the line, I'd be glad to reconnect. No hard feelings either way.

Wishing {{company}} continued success.

{{sender_name}}`,
    variables: ['first_name', 'company', 'pain_point', 'sender_name'],
  },
  {
    name: 'Referral from Mutual Connection',
    use_case: 'referral',
    tone: 'warm',
    category: 'smb_sales',
    is_system: true,
    is_default: false,
    subject: '{{mutual_connection}} thought we should connect',
    body: `Hi {{first_name}},

{{mutual_connection}} mentioned you might be dealing with {{pain_point}} at {{company}} and suggested I reach out.

{{your_company}} has helped similar companies {{benefit}}, and I'd love to see if we can do the same for you.

Would 20 minutes this week or next work?

{{sender_name}}`,
    variables: ['first_name', 'mutual_connection', 'company', 'pain_point', 'your_company', 'benefit', 'sender_name'],
  },
]

export async function seedSystemTemplates(supabase: SupabaseClient): Promise<void> {
  const allTemplates = [...JOB_SEEKER_TEMPLATES, ...SMB_SALES_TEMPLATES]

  const { error } = await supabase
    .from('email_templates')
    .upsert(
      allTemplates.map((t) => ({
        ...t,
        user_id: null, // system templates are not owned by any user
      })),
      { onConflict: 'name,is_system', ignoreDuplicates: true }
    )

  if (error) {
    throw new Error(`Failed to seed system templates: ${error.message}`)
  }

  console.log(`[seed] Seeded ${allTemplates.length} system templates`)
}
