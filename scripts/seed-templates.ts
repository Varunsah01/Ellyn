import { createServiceRoleClient } from '../lib/supabase/server'

type UseCase = 'job_seeker' | 'smb_sales' | 'general'
type Category = 'job_seeker' | 'smb_sales' | 'general'

type TemplateSeed = {
  name: string
  category: Category
  tone: string
  subject: string
  body: string
  use_case: UseCase
  variables: string[]
}

const TEMPLATE_LIBRARY: TemplateSeed[] = [
  {
    name: 'Cold Outreach to Hiring Manager',
    category: 'job_seeker',
    tone: 'professional',
    subject: 'Quick question about {{role}} opportunities at {{company}}',
    body: `Hi {{firstName}},

I came across your profile while researching {{company}} and was genuinely
impressed by [specific thing about the team / recent news].

I'm currently exploring {{role}} opportunities and believe my background in
[your skill] could add real value to your team. I'd love to hear about how
{{company}} approaches [relevant challenge].

Would you be open to a 15-minute chat this week?

Best,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'role', 'company', 'userName'],
  },
  {
    name: 'Recruiter Introduction — Tech Role',
    category: 'job_seeker',
    tone: 'friendly',
    subject: 'Referred by LinkedIn — {{role}} candidate',
    body: `Hi {{firstName}},

I noticed you recruit for {{role}} roles at {{company}} and wanted to reach out
directly. I have [X years] of experience in [core skill] and am actively
exploring my next opportunity.

A quick snapshot of what I bring:
• [Achievement 1 with metric]
• [Achievement 2 with metric]
• [Relevant tech / tool stack]

I'd love to connect and learn more about what you're looking for. Are you
open to a brief call?

Thanks,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'role', 'company', 'userName'],
  },
  {
    name: 'Alumni Network Outreach',
    category: 'job_seeker',
    tone: 'warm',
    subject: 'Fellow {{userSchool}} alum — quick question',
    body: `Hi {{firstName}},

I found your profile through the {{userSchool}} alumni network. It's great
to see a fellow [School Year / Major] alum doing such interesting work at
{{company}}.

I'm currently a {{userMajor}} grad exploring roles in [field] and would love
to hear about your experience at {{company}} — especially how you got into
{{role}}.

Would you be willing to spare 20 minutes for a virtual coffee?

Warm regards,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'userSchool', 'company', 'role', 'userName', 'userMajor'],
  },
  {
    name: 'Follow-Up After Application',
    category: 'job_seeker',
    tone: 'professional',
    subject: 'Following up — {{role}} application at {{company}}',
    body: `Hi {{firstName}},

I recently applied for the {{role}} position at {{company}} and wanted to
follow up to express my continued enthusiasm.

I'm particularly drawn to {{company}}'s [specific mission / product / team]
and am confident my experience in [skill] aligns well with what you're
looking for. I've attached my resume again for convenience.

Please let me know if you need anything else from my side. I look forward
to hearing from you.

Best,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'role', 'company', 'userName'],
  },
  {
    name: 'Internship Request — Student',
    category: 'job_seeker',
    tone: 'enthusiastic',
    subject: 'Internship inquiry — {{userMajor}} student at {{userSchool}}',
    body: `Hi {{firstName}},

My name is {{userName}}, a {{userMajor}} student at {{userSchool}}. I've been
following {{company}}'s work on [specific project / product] and would love
the chance to contribute as an intern this [season/year].

I've been building [relevant project] and am eager to learn from a team like
yours. I'd greatly appreciate even 10 minutes to discuss any open or upcoming
internship roles.

Thank you for your time,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'company', 'userName', 'userSchool', 'userMajor'],
  },
  {
    name: 'Re-Engagement After Referral',
    category: 'job_seeker',
    tone: 'professional',
    subject: '{{mutualName}} suggested I reach out',
    body: `Hi {{firstName}},

[Mutual contact] thought I should connect with you regarding opportunities
at {{company}}. I've been following your team's work in [area] and believe
there could be a strong fit.

I'm currently a {{role}} with [X years] of experience in [domain]. I'd love
to find a time to connect.

Best,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'company', 'role', 'userName'],
  },
  {
    name: 'Thank You Post-Interview',
    category: 'job_seeker',
    tone: 'grateful',
    subject: 'Thank you — {{role}} interview at {{company}}',
    body: `Hi {{firstName}},

Thank you for taking the time to speak with me today about the {{role}}
position at {{company}}. I really enjoyed learning about [specific topic
discussed] and left the conversation even more excited about the opportunity.

Our discussion reinforced my belief that my experience in [skill] would
translate well to your team's goals around [goal mentioned].

I look forward to next steps and am happy to provide any additional
information.

Best,
{{userName}}`,
    use_case: 'job_seeker',
    variables: ['firstName', 'role', 'company', 'userName'],
  },
  {
    name: 'Cold Outreach — Pain-Led',
    category: 'smb_sales',
    tone: 'direct',
    subject: '{{company}} + [Your Company] — worth 10 minutes?',
    body: `Hi {{firstName}},

Most {{role}}s I speak with at companies like {{company}} are dealing with
[common pain point]. Sound familiar?

We've helped teams at [Reference Customer] achieve [specific result] in
[timeframe] by [one-sentence value prop].

I'd love to show you a quick demo. Are you free for 10 minutes next Tuesday
or Wednesday?

— {{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'role', 'userName'],
  },
  {
    name: 'Competitor Displacement',
    category: 'smb_sales',
    tone: 'confident',
    subject: 'Thinking of switching from [Competitor]?',
    body: `Hi {{firstName}},

I noticed {{company}} is using [Competitor]. Many of our customers switched
from there because of [pain point: e.g., price / features / support].

Here's what they gained after moving to [Your Product]:
• [Benefit 1]
• [Benefit 2]
• [Benefit 3]

If any of this resonates, I can walk you through a quick side-by-side
comparison. No pressure — just facts.

{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Executive Sponsor Outreach',
    category: 'smb_sales',
    tone: 'executive',
    subject: "Relevant to {{company}}'s Q[X] priorities",
    body: `Hi {{firstName}},

I'll be brief — I lead [partnerships / sales] at [Your Company] and I believe
we can directly support {{company}}'s initiative around [strategic priority].

We've worked with [2–3 similar companies] to [measurable outcome]. I think
a 20-minute conversation could be valuable for you.

Can we find time this week?

Best,
{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Event / Conference Follow-Up',
    category: 'smb_sales',
    tone: 'friendly',
    subject: 'Great meeting you at [Event Name], {{firstName}}',
    body: `Hi {{firstName}},

It was great connecting at [Event Name]! I enjoyed our conversation about
[topic discussed].

As promised, here's [the resource / demo link / case study] I mentioned.
I think it maps closely to what {{company}} is working on.

Would love to continue the conversation — are you free for a call next week?

{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Product Demo Request',
    category: 'smb_sales',
    tone: 'consultative',
    subject: '15-min demo — built for teams like {{company}}',
    body: `Hi {{firstName}},

Based on {{company}}'s growth in [area], I think our platform could be
particularly relevant right now.

In 15 minutes I can show you:
1. How [Feature] solves [specific pain] for {{role}}s
2. [Customer] results — [stat] in [timeframe]
3. How you'd be up and running in [timeline]

Would [Day] or [Day] work for a quick screen share?

{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'role', 'userName'],
  },
  {
    name: 'Re-Engagement — Gone Cold',
    category: 'smb_sales',
    tone: 'light',
    subject: 'Still relevant, {{firstName}}?',
    body: `Hi {{firstName}},

I know things get busy. Circling back since we last spoke [timeframe] ago
about [topic].

One thing that may have changed: [new feature / new case study / relevant
news about their industry].

Worth a quick catch-up? I'll keep it under 10 minutes.

{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'userName'],
  },
  {
    name: 'Referral Ask',
    category: 'smb_sales',
    tone: 'direct',
    subject: 'Quick favour, {{firstName}}',
    body: `Hi {{firstName}},

I'm reaching out because I'm trying to connect with {{role}}s at
{{company}}-type companies.

Do you know anyone in your network who might be dealing with [pain point]
and would benefit from a conversation? Happy to return the favour.

Thanks in advance,
{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'role', 'company', 'userName'],
  },
  {
    name: 'Case Study Drop',
    category: 'smb_sales',
    tone: 'value-first',
    subject: 'How [Similar Company] solved [pain] — relevant to {{company}}',
    body: `Hi {{firstName}},

Thought this might be useful: [Similar Company] was struggling with
[pain point] — a challenge I suspect {{company}} faces too.

Here's how they solved it: [brief outcome sentence].

Full case study → [link]

Happy to walk you through the specifics if helpful.

{{userName}}`,
    use_case: 'smb_sales',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Introduction — New Connection',
    category: 'general',
    tone: 'friendly',
    subject: 'Connecting from LinkedIn, {{firstName}}',
    body: `Hi {{firstName}},

I came across your profile on LinkedIn and wanted to reach out — your work
at {{company}} in [area] really stood out to me.

I'm {{userName}} and I work in [your field]. I'd love to connect and swap
notes on [shared interest / industry topic].

Looking forward to it,
{{userName}}`,
    use_case: 'general',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Partnership Proposal',
    category: 'general',
    tone: 'collaborative',
    subject: 'Partnership idea — {{company}} + [Your Company]',
    body: `Hi {{firstName}},

I've been thinking about how {{company}} and [Your Company] could create
mutual value — specifically around [shared audience / complementary product].

I have a few concrete ideas I'd love to share. Would you be open to a
30-minute brainstorm?

{{userName}}`,
    use_case: 'general',
    variables: ['firstName', 'company', 'userName'],
  },
  {
    name: 'Warm Introduction Request',
    category: 'general',
    tone: 'professional',
    subject: 'Introduction request — {{firstName}}',
    body: `Hi {{firstName}},

I hope you're doing well! I'm looking to connect with {{fullName}} at
{{company}} and thought you might be the perfect person to make an
introduction.

I'd be happy to draft a quick intro note if that makes it easier.
And of course, happy to return the favour any time.

Thanks,
{{userName}}`,
    use_case: 'general',
    variables: ['firstName', 'fullName', 'company', 'userName'],
  },
]

async function seedTemplates() {
  const supabase = await createServiceRoleClient()

  const payload = TEMPLATE_LIBRARY.map((template) => ({
    ...template,
    user_id: null,
    is_default: true,
    is_system: true,
  }))

  const { data, error } = await supabase
    .from('email_templates')
    .upsert(payload, { onConflict: 'name,is_default', ignoreDuplicates: true })
    .select('id')

  if (error) {
    throw new Error(`Failed to seed templates: ${error.message}`)
  }

  const insertedCount = data?.length ?? 0
  const skippedCount = payload.length - insertedCount

  console.log(
    `[seed:templates] inserted=${insertedCount} skipped=${skippedCount} total=${payload.length}`
  )
}

void seedTemplates().catch((error) => {
  console.error('[seed:templates] error:', error)
  process.exit(1)
})
