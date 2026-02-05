import { NextRequest, NextResponse } from "next/server";

// Default email templates
const defaultTemplates = [
  {
    id: "cold-outreach",
    name: "Cold Outreach",
    subject: "Quick question about {{company}}",
    body: `Hi {{firstName}},

I came across {{company}} and was impressed by your work in {{industry}}.

I wanted to reach out because [YOUR REASON HERE].

Would you be open to a quick chat this week?

Best regards,
[YOUR NAME]`,
  },
  {
    id: "follow-up",
    name: "Follow Up",
    subject: "Following up - {{company}}",
    body: `Hi {{firstName}},

I wanted to follow up on my previous email about [TOPIC].

I believe there could be value in connecting, especially regarding [SPECIFIC VALUE PROPOSITION].

Let me know if you'd like to schedule a brief call.

Thanks,
[YOUR NAME]`,
  },
  {
    id: "introduction",
    name: "Introduction",
    subject: "Introduction - {{yourName}} + {{firstName}}",
    body: `Hi {{firstName}},

My name is {{yourName}} and I work on [YOUR WORK/COMPANY].

I noticed you're at {{company}} and thought we might have some interesting synergies around [TOPIC/AREA].

Would love to connect if you have 15 minutes in the coming weeks.

Best,
{{yourName}}`,
  },
  {
    id: "value-proposition",
    name: "Value Proposition",
    subject: "Helping {{company}} with [SPECIFIC OUTCOME]",
    body: `Hi {{firstName}},

I help companies like {{company}} achieve [SPECIFIC OUTCOME] through [YOUR SOLUTION].

Some recent results we've delivered:
• [RESULT 1]
• [RESULT 2]
• [RESULT 3]

Would you be interested in learning more about how we could help {{company}}?

Looking forward to hearing from you,
[YOUR NAME]`,
  },
];

export async function GET(request: NextRequest) {
  try {
    // In a production app, you'd fetch user's custom templates from database
    // For now, return default templates
    return NextResponse.json({
      templates: defaultTemplates,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// For future implementation: save custom templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, body: templateBody } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, subject, body" },
        { status: 400 }
      );
    }

    // TODO: Save custom template to database
    // For now, return success
    return NextResponse.json({
      success: true,
      message: "Template saved successfully",
    });
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }
}
