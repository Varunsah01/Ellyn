import type { Page } from "@playwright/test";

type SupabaseSignInOptions = {
  email?: string;
  fullName?: string;
  userId?: string;
};

type SignupApiOptions = {
  message?: string;
  hasSession?: boolean;
  email?: string;
  fullName?: string;
  userId?: string;
};

type DiscoveryEmailPattern = {
  email: string;
  pattern: string;
  confidence: number;
  learned?: boolean;
  learnedData?: {
    attempts: number;
    successRate: number;
  };
};

type LeadRecord = {
  id: string;
  person_name: string;
  company_name: string;
  discovered_emails: DiscoveryEmailPattern[];
  selected_email: string | null;
  status: "discovered" | "sent" | "bounced" | "replied";
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonBody<T>(rawBody: string | null): T | null {
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

function extractEmailFromBody(rawBody: string | null): string | null {
  if (!rawBody) return null;

  const asJson = parseJsonBody<{ email?: string }>(rawBody);
  if (typeof asJson?.email === "string" && asJson.email.trim()) {
    return asJson.email.trim().toLowerCase();
  }

  const params = new URLSearchParams(rawBody);
  const email = params.get("email");
  return email ? email.trim().toLowerCase() : null;
}

function buildSupabaseUser(email: string, fullName: string, userId: string) {
  const timestamp = nowIso();
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: timestamp,
    phone: "",
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    user_metadata: {
      full_name: fullName,
      name: fullName,
    },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function buildSupabaseSession(email: string, fullName: string, userId: string) {
  const expiresInSeconds = 60 * 60;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  return {
    access_token: `mock-access-token-${userId}`,
    token_type: "bearer",
    expires_in: expiresInSeconds,
    expires_at: expiresAt,
    refresh_token: `mock-refresh-token-${userId}`,
    user: buildSupabaseUser(email, fullName, userId),
  };
}

export async function mockSupabaseSignIn(
  page: Page,
  options: SupabaseSignInOptions = {},
): Promise<void> {
  const fallbackEmail = (options.email || "existing-user@example.com").toLowerCase();
  const fallbackFullName = options.fullName || "Existing User";
  const fallbackUserId = options.userId || "mock-user-id";

  await page.route("**/auth/v1/token**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
      return;
    }

    const requestEmail = extractEmailFromBody(route.request().postData());
    const email = requestEmail || fallbackEmail;
    const session = buildSupabaseSession(email, fallbackFullName, fallbackUserId);
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify(session),
    });
  });

  await page.route("**/auth/v1/user**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
      return;
    }

    const user = buildSupabaseUser(fallbackEmail, fallbackFullName, fallbackUserId);
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify(user),
    });
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
      },
      body: "",
    });
  });
}

export async function mockSignupApi(
  page: Page,
  options: SignupApiOptions = {},
): Promise<void> {
  await page.route("**/api/v1/auth/signup", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const rawBody = route.request().postData();
    const body = parseJsonBody<{ email?: string; name?: string }>(rawBody);

    const email = (body?.email || options.email || "new-user@example.com").toLowerCase();
    const fullName = body?.name || options.fullName || "New User";
    const userId = options.userId || "mock-signup-user-id";
    const hasSession = Boolean(options.hasSession);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message:
          options.message ||
          "Account created. Check your email to verify your address before signing in.",
        hasSession,
        user: hasSession ? buildSupabaseUser(email, fullName, userId) : null,
      }),
    });
  });
}

export async function mockPasswordChangeApi(
  page: Page,
  message = "Password updated successfully.",
): Promise<void> {
  await page.route("**/api/v1/auth/change-password", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message }),
    });
  });
}

export async function mockDashboardApis(page: Page): Promise<void> {
  const contacts = [
    {
      id: "dashboard-contact-1",
      full_name: "Jordan Lee",
      first_name: "Jordan",
      last_name: "Lee",
      company: "Acme Labs",
      role: "Software Engineer",
      inferred_email: "jordan.lee@acmelabs.com",
      confirmed_email: null,
      email_confidence: 86,
      status: "contacted",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "dashboard-contact-2",
      full_name: "Maya Patel",
      first_name: "Maya",
      last_name: "Patel",
      company: "Globex",
      role: "Product Manager",
      inferred_email: "maya.patel@globex.com",
      confirmed_email: null,
      email_confidence: 78,
      status: "replied",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  const templates = [
    {
      id: "template-1",
      name: "Referral Ask",
      subject: "Quick question about {{company}}",
      body: "Hi {{firstName}}, I would love to connect.",
      is_default: false,
      category: "referral",
      tags: ["referral"],
      icon: "mail",
      use_count: 3,
      created_at: nowIso(),
      updated_at: nowIso(),
      description: "Referral template",
    },
  ];

  const drafts = [
    {
      id: "draft-1",
      contact_id: "dashboard-contact-1",
      subject: "Hello Jordan",
      body: "Following up from LinkedIn.",
      status: "sent",
      created_at: nowIso(),
      updated_at: nowIso(),
      contacts: {
        full_name: "Jordan Lee",
        confirmed_email: null,
        inferred_email: "jordan.lee@acmelabs.com",
      },
    },
  ];

  await page.route("**/api/v1/contacts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        contacts,
        totalCount: contacts.length,
        pagination: {
          page: 1,
          limit: contacts.length,
          total: contacts.length,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route("**/api/v1/templates**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        templates,
      }),
    });
  });

  await page.route("**/api/v1/drafts**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        drafts,
      }),
    });
  });
}

export async function mockAnalyticsApis(page: Page): Promise<void> {
  await page.route("**/api/v1/analytics?**", async (route) => {
    const url = new URL(route.request().url());
    const metric = url.searchParams.get("metric");

    const activityHeatmap = [
      {
        day: "Mon",
        dayIndex: 1,
        hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: hour === 10 || hour === 14 ? 3 : 0,
        })),
      },
      {
        day: "Tue",
        dayIndex: 2,
        hours: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: hour === 9 ? 2 : 0,
        })),
      },
    ];

    const payloadByMetric: Record<string, unknown> = {
      overview: {
        data: {
          totalContacts: 42,
          totalDrafts: 19,
          emailsSent: 17,
          replyRate: "29.4",
          bestPerformingSequence: "Referral Warm Intro",
          bestPerformingReplyRate: "36.0",
          mostActiveDay: "Tuesday",
          mostActiveHour: "10:00",
        },
        comparison: {
          contacts: 6,
          drafts: 3,
          emailsSent: 2,
          replyRate: 4.1,
        },
      },
      contacts_over_time: {
        data: [
          { date: "2026-02-10", count: 3, label: "Feb 10" },
          { date: "2026-02-11", count: 5, label: "Feb 11" },
          { date: "2026-02-12", count: 4, label: "Feb 12" },
        ],
      },
      sequence_performance: {
        data: [
          {
            id: "seq-1",
            name: "Referral Warm Intro",
            enrolled: 20,
            sent: 18,
            opened: 11,
            replied: 6,
            openRate: 61.1,
            replyRate: 33.3,
          },
        ],
      },
      contact_insights: {
        data: {
          topCompanies: [
            { name: "Acme Labs", count: 8 },
            { name: "Globex", count: 6 },
          ],
          topRoles: [
            { name: "Software Engineer", count: 10 },
            { name: "Product Manager", count: 5 },
          ],
          sourceBreakdown: [
            { source: "manual", count: 20, percentage: "47.6" },
            { source: "extension", count: 22, percentage: "52.4" },
          ],
          topTags: [
            { name: "referral", count: 7 },
            { name: "frontend", count: 4 },
          ],
        },
      },
      activity_heatmap: {
        data: activityHeatmap,
      },
      tracker_performance: {
        data: {
          totalTracked: 42,
          drafted: 30,
          sent: 24,
          replied: 7,
          noResponse: 12,
          followUpNeeded: 9,
          replyRate: 29.2,
          topCompanies: [
            { company: "Acme Labs", sent: 8, replied: 3, replyRate: 37.5 },
          ],
        },
      },
    };

    const payload = payloadByMetric[metric || ""] || { data: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

function toLeadRecord(
  input: {
    personName: string;
    companyName: string;
    emails: DiscoveryEmailPattern[];
    selectedEmail?: string | null;
    status?: "discovered" | "sent" | "bounced" | "replied";
  },
  id: string,
): LeadRecord {
  const timestamp = nowIso();
  return {
    id,
    person_name: input.personName,
    company_name: input.companyName,
    discovered_emails: input.emails,
    selected_email: input.selectedEmail || null,
    status: input.status || "discovered",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function mockDiscoveryApis(page: Page): Promise<{
  getLeads: () => LeadRecord[];
}> {
  const leads: LeadRecord[] = [];
  const emailPatterns: DiscoveryEmailPattern[] = [
    {
      email: "john.doe@microsoft.com",
      pattern: "first.last",
      confidence: 88,
      learned: true,
      learnedData: { attempts: 42, successRate: 85 },
    },
    {
      email: "jdoe@microsoft.com",
      pattern: "flast",
      confidence: 71,
    },
    {
      email: "john_doe@microsoft.com",
      pattern: "first_last",
      confidence: 55,
    },
  ];

  await page.route("**/api/v1/enrich", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enrichment: {
          domain: "microsoft.com",
          size: "large",
          mxRecords: 6,
          emailProvider: "Microsoft 365",
        },
        emails: emailPatterns,
        verification: {
          mxVerified: true,
          learningApplied: true,
        },
      }),
    });
  });

  await page.route("**/api/v1/pattern-feedback", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/v1/leads**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === "GET" && url.pathname.endsWith("/api/v1/leads")) {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const status = url.searchParams.get("status") || "all";
      const pageNumber = Number(url.searchParams.get("page") || "1");
      const limit = Number(url.searchParams.get("limit") || "20");

      let filtered = leads;

      if (status !== "all") {
        filtered = filtered.filter((lead) => lead.status === status);
      }

      if (search) {
        filtered = filtered.filter(
          (lead) =>
            lead.person_name.toLowerCase().includes(search) ||
            lead.company_name.toLowerCase().includes(search),
        );
      }

      const start = (pageNumber - 1) * limit;
      const paged = filtered.slice(start, start + limit);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          leads: paged,
          pagination: {
            page: pageNumber,
            limit,
            total: filtered.length,
            totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          },
        }),
      });
      return;
    }

    if (method === "POST" && url.pathname.endsWith("/api/v1/leads")) {
      const payload = parseJsonBody<{
        personName: string;
        companyName: string;
        emails: DiscoveryEmailPattern[];
        selectedEmail?: string | null;
        status?: "discovered" | "sent" | "bounced" | "replied";
      }>(route.request().postData());

      const lead = toLeadRecord(
        payload || {
          personName: "Unknown",
          companyName: "Unknown",
          emails: emailPatterns,
        },
        `lead-${Date.now()}`,
      );
      leads.unshift(lead);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          lead,
          message: "Lead created successfully",
        }),
      });
      return;
    }

    if (method === "DELETE" && url.pathname.includes("/api/v1/leads/")) {
      const leadId = url.pathname.split("/").pop();
      const index = leads.findIndex((lead) => lead.id === leadId);
      if (index >= 0) {
        leads.splice(index, 1);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    getLeads: () => leads.map((lead) => ({ ...lead })),
  };
}
