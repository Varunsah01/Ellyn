import {
  buildTrackerContactHref,
  consumeTrackerDeepLinkContact,
  countContactsNeedingFollowUp,
  mapSequenceActionToTrackerContactPatch,
  saveTrackerDeepLinkContact,
  toTrackerContact,
} from "@/lib/tracker-integration";

describe("tracker integration helpers", () => {
  test("buildTrackerContactHref builds deep link with source", () => {
    const href = buildTrackerContactHref("abc-123", { source: "contacts" });
    expect(href).toBe("/dashboard/tracker?contactId=abc-123&source=contacts");
  });

  test("toTrackerContact normalizes legacy statuses", () => {
    expect(toTrackerContact({ id: "1", status: "responded" }).status).toBe("replied");
    expect(toTrackerContact({ id: "1", status: "not_interested" }).status).toBe("no_response");
    expect(toTrackerContact({ id: "1", status: "new" }).status).toBe("new");
  });

  test("countContactsNeedingFollowUp counts only overdue contacted leads", () => {
    const now = new Date("2026-02-12T12:00:00.000Z");
    const contacts = [
      {
        id: "c-1",
        status: "contacted",
        last_contacted_at: "2026-02-01T09:00:00.000Z",
      },
      {
        id: "c-2",
        status: "replied",
        last_contacted_at: "2026-02-01T09:00:00.000Z",
      },
      {
        id: "c-3",
        status: "contacted",
        last_contacted_at: "2026-02-10T09:00:00.000Z",
      },
    ];

    expect(countContactsNeedingFollowUp(contacts, now)).toBe(1);
  });

  test("maps sequence actions to tracker contact patches", () => {
    const sentPatch = mapSequenceActionToTrackerContactPatch("mark_sent", "2026-02-12T12:00:00.000Z");
    expect(sentPatch).toEqual({
      status: "contacted",
      last_contacted_at: "2026-02-12T12:00:00.000Z",
      updated_at: "2026-02-12T12:00:00.000Z",
    });

    const repliedPatch = mapSequenceActionToTrackerContactPatch("mark_replied", "2026-02-12T12:00:00.000Z");
    expect(repliedPatch).toEqual({
      status: "replied",
      updated_at: "2026-02-12T12:00:00.000Z",
    });

    expect(mapSequenceActionToTrackerContactPatch("skip_step")).toBeNull();
  });

  test("deep-link contact handoff is persisted and consumed once", () => {
    const contact = {
      id: "handoff-1",
      full_name: "Seed Contact",
      company: "Seed Co",
      role: "Engineer",
      status: "new",
    };

    saveTrackerDeepLinkContact(contact);
    expect(consumeTrackerDeepLinkContact("handoff-1")).toEqual(contact);
    expect(consumeTrackerDeepLinkContact("handoff-1")).toBeNull();
  });
});

