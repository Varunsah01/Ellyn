import {
  DEFAULT_TRACKER_FILTERS,
  applySortPreset,
  applyTrackerFilters,
  computeTrackerAnalytics,
  matchesTrackerSearch,
} from "@/lib/tracker-v2";
import type { TrackerContact } from "@/lib/types/tracker";

const CONTACTS: TrackerContact[] = [
  {
    id: "a",
    full_name: "Alice Doe",
    company: "Figma",
    role: "Product Designer",
    inferred_email: "alice@figma.com",
    confirmed_email: null,
    status: "new",
    outreach_status: "draft",
    created_at: "2026-02-10T10:00:00.000Z",
    updated_at: "2026-02-10T10:00:00.000Z",
    timeline: [],
  },
  {
    id: "b",
    full_name: "Bob Ray",
    company: "Stripe",
    role: "Software Engineer",
    inferred_email: "bob@stripe.com",
    confirmed_email: null,
    status: "contacted",
    outreach_status: "sent",
    last_contacted_at: "2026-02-01T10:00:00.000Z",
    created_at: "2026-02-01T10:00:00.000Z",
    updated_at: "2026-02-01T10:00:00.000Z",
    timeline: [],
  },
  {
    id: "c",
    full_name: "Carol Zee",
    company: "Stripe",
    role: "Engineering Manager",
    inferred_email: "carol@stripe.com",
    confirmed_email: null,
    status: "replied",
    outreach_status: "replied",
    last_contacted_at: "2026-02-05T10:00:00.000Z",
    created_at: "2026-02-05T10:00:00.000Z",
    updated_at: "2026-02-05T10:00:00.000Z",
    timeline: [
      {
        id: "c-1",
        type: "email_sent",
        title: "Email sent",
        created_at: "2026-02-03T10:00:00.000Z",
      },
      {
        id: "c-2",
        type: "replied",
        title: "Reply received",
        created_at: "2026-02-04T10:00:00.000Z",
      },
    ],
  },
];

const primaryContact = CONTACTS[0];
if (!primaryContact) {
  throw new Error("Test setup failed: expected seed contacts to exist.");
}

describe("tracker-v2 shared logic", () => {
  test("matchesTrackerSearch checks name, company, and role", () => {
    expect(matchesTrackerSearch(primaryContact, "alice")).toBe(true);
    expect(matchesTrackerSearch(primaryContact, "figma")).toBe(true);
    expect(matchesTrackerSearch(primaryContact, "designer")).toBe(true);
    expect(matchesTrackerSearch(primaryContact, "stripe")).toBe(false);
  });

  test("applyTrackerFilters supports needs_follow_up and company filters", () => {
    const now = new Date("2026-02-12T10:00:00.000Z");
    const filtered = applyTrackerFilters(
      CONTACTS,
      "",
      {
        ...DEFAULT_TRACKER_FILTERS,
        statuses: ["needs_follow_up"],
        companies: ["Stripe"],
      },
      now
    );

    expect(filtered.map((item) => item.id)).toEqual(["b"]);
  });

  test("applySortPreset(no_response) prioritizes no_response contacts", () => {
    const contactsWithNoResponse: TrackerContact[] = [
      {
        ...primaryContact,
        id: "n-1",
        status: "no_response",
        last_contacted_at: "2026-02-02T10:00:00.000Z",
      },
      {
        ...primaryContact,
        id: "n-2",
        status: "new",
      },
      {
        ...primaryContact,
        id: "n-3",
        status: "no_response",
        last_contacted_at: "2026-02-10T10:00:00.000Z",
      },
    ];

    const sorted = applySortPreset(contactsWithNoResponse, "no_response");
    expect(sorted[0]?.id).toBe("n-3");
    expect(sorted[1]?.id).toBe("n-1");
  });

  test("computeTrackerAnalytics returns funnel and reply rate", () => {
    const analytics = computeTrackerAnalytics(CONTACTS);
    expect(analytics.funnel).toEqual({
      drafted: 1,
      sent: 2,
      replied: 1,
    });
    expect(analytics.replyRate).toBe(50);
    expect(analytics.averageResponseHours).toBe(24);
  });
});
