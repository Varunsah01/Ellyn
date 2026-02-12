# Tracker Integration (V2)

## Overview
The Tracker is now integrated across Contacts, Sequences/Drafts, Analytics, and Sidebar navigation.
It supports deep-linking into a specific contact, follow-up prioritization, tracker metrics in analytics, and shared search/filter logic.

## Integration Points
1. Contacts -> Tracker
- `components/contacts/contacts-table.tsx` adds **View in Tracker** row action.
- Action deep-links to `/dashboard/tracker?contactId=<id>&source=contacts`.
- A local handoff payload is written so Tracker can open details even if datasets differ.

2. Tracker deep-link handling
- `app/dashboard/tracker/page.tsx` consumes `contactId` from URL.
- If contact is missing in current in-memory data, it hydrates from deep-link payload and opens detail modal.

3. Drafts/Sequences -> Tracker status sync
- `app/api/sequences/execute/route.ts`
  - `mark_sent` updates contact to `contacted`.
  - `mark_replied` updates contact to `replied`.
- `app/api/drafts/route.ts`
  - Draft save/update with `status=sent` updates related contact to `contacted`.

4. Tracker -> Drafts
- `components/tracker/ContactDetailModal.tsx` fetches draft history for contact from `/api/drafts?contactId=...`.
- Modal includes direct link to `/dashboard/sequences?contactId=...`.

5. Tracker -> Analytics
- `app/api/analytics/route.ts` adds `metric=tracker_performance`.
- `app/dashboard/analytics/page.tsx` fetches and renders tracker metrics.
- `components/analytics/tracker-performance.tsx` shows tracker funnel, follow-up backlog, and company performance.

6. Sidebar
- `components/dashboard/sidebar.tsx` shows tracker follow-up badge count.
- Count is computed from contacts using shared tracker follow-up logic.

## Shared Utilities
- `lib/tracker-v2.ts`
  - `matchesTrackerSearch`: common search behavior (name/company/role).
- `lib/tracker-integration.ts`
  - `toTrackerContact`
  - `buildTrackerContactHref`
  - `countContactsNeedingFollowUp`
  - `mapSequenceActionToTrackerContactPatch`
  - `saveTrackerDeepLinkContact` / `consumeTrackerDeepLinkContact`

## Tracker Analytics API Response
`GET /api/analytics?metric=tracker_performance`

```json
{
  "data": {
    "totalTracked": 0,
    "drafted": 0,
    "sent": 0,
    "replied": 0,
    "noResponse": 0,
    "followUpNeeded": 0,
    "replyRate": 0,
    "topCompanies": [
      {
        "company": "Example Inc",
        "sent": 10,
        "replied": 4,
        "replyRate": 40
      }
    ]
  }
}
```

## Seed Script
`scripts/seed-tracker-test-data.mjs`

Commands:
1. `npm run seed:tracker`
Creates fixture files (50 contacts + empty fixture) for tests.
2. `npm run seed:tracker:api`
Seeds 50 contacts to local API (`http://localhost:3000`) after clearing previous seeded data.
3. `npm run seed:tracker:clear`
Clears seeded contacts from local API to validate empty-state scenarios.

## Manual QA Checklist
- [ ] All filters work independently.
- [ ] Combined filters work together.
- [ ] Drag-and-drop updates status in the database.
- [ ] Search returns expected contacts by company/name/role.
- [ ] Sorting works in all directions.
- [ ] Bulk actions apply to all selected contacts.
- [ ] Mobile view is usable.
- [ ] Export generates valid CSV.
- [ ] Loading states appear.
- [ ] Error state shows with retry button.
- [ ] Tracker deep-link from Contacts opens the correct contact detail.
- [ ] Marking sequence step as sent updates Tracker status.
- [ ] Draft status `sent` updates Tracker status.
- [ ] Tracker analytics section loads in Analytics page.
- [ ] Export includes tracker metrics when present.

## Edge Cases
- [ ] 0 contacts.
- [ ] 1000+ contacts.
- [ ] Very long names/companies.
- [ ] Special characters in search.
- [ ] Network errors.
- [ ] Concurrent status updates.

## Error Scenarios
- [ ] API timeout.
- [ ] Database connection lost.
- [ ] Invalid filter combinations.
- [ ] Malformed data.

## Final Release Checklist
- [ ] No console errors.
- [ ] No TypeScript errors.
- [ ] Responsive on all screen sizes.
- [ ] Dark mode works.
- [ ] Filters persist on page reload.
- [ ] URL reflects filter state (shareable).
- [ ] Works with 0 and 1000+ contacts.
- [ ] Loading states prevent multiple clicks.
- [ ] Success/error toasts show correct messages.
