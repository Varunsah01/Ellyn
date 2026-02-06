# Manual QA Checklist

Test each feature thoroughly before release. Check off each item as you complete it.

## Pre-Flight Checks

- [ ] Dev server starts without errors (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] All automated tests pass (`npm test`)
- [ ] No console errors on page load
- [ ] Environment variables are set correctly

## Extension Testing

### Installation
- [ ] Install extension on fresh Chrome profile
- [ ] Extension icon appears in toolbar
- [ ] Extension popup opens without errors
- [ ] Extension has proper permissions

### LinkedIn Extraction
- [ ] Navigate to LinkedIn profile
- [ ] Click extension icon
- [ ] Profile data extracts correctly (name, company, role)
- [ ] All 13 email patterns generate
- [ ] Patterns are unique and valid
- [ ] Confidence scores display (0-100%)

### Edge Cases - Names
- [ ] Handles hyphenated names (Mary Smith-Jones)
- [ ] Handles apostrophes (O'Brien)
- [ ] Handles suffixes (Jr., Sr., III)
- [ ] Handles single letter names (J. Doe)
- [ ] Handles very long names (Christopher Montgomery)
- [ ] Handles Unicode characters (José González)

### Edge Cases - Companies
- [ ] Handles company with special chars (AT&T)
- [ ] Handles company with Inc/LLC (Acme Inc.)
- [ ] Handles multi-word companies (JP Morgan Chase)
- [ ] Handles single letter companies (X)

### Extension → Dashboard Sync
- [ ] Save contact from extension
- [ ] Contact appears in dashboard within 5 seconds
- [ ] All fields sync correctly
- [ ] Email patterns sync
- [ ] Confidence scores sync

## Dashboard Testing

### Navigation
- [ ] Sidebar navigation works
- [ ] All menu items accessible
- [ ] Breadcrumbs update correctly
- [ ] Command palette opens (Cmd/Ctrl+K)
- [ ] Keyboard shortcuts work

### Contacts Page
- [ ] Contacts table loads
- [ ] Search filters contacts
- [ ] Sort by columns works
- [ ] Pagination works (if >10 contacts)
- [ ] Add contact dialog opens
- [ ] New contact saves successfully
- [ ] Edit contact works
- [ ] Delete contact works (with confirmation)
- [ ] Export contacts to CSV
- [ ] Import contacts from CSV

### Sequences Page
- [ ] Sequences list loads
- [ ] Create new sequence works
- [ ] Template variables render ({{firstName}}, {{company}})
- [ ] Save template succeeds
- [ ] Edit sequence works
- [ ] Delete sequence works
- [ ] Enroll contacts in sequence
- [ ] Generate drafts from sequence

### Drafts Page
- [ ] Drafts list loads
- [ ] Draft preview shows correctly
- [ ] "Open in Gmail" button works
- [ ] "Open in Outlook" button works
- [ ] Mark as sent updates status
- [ ] Edit draft works
- [ ] Delete draft works

### Analytics Page
- [ ] Overview metrics display
- [ ] Charts render without errors
- [ ] Date range filter works
- [ ] Last 7/30/90 days presets work
- [ ] Custom date picker works
- [ ] Period comparison toggle works
- [ ] Trend indicators show (↑↓)
- [ ] Tab switching works (Overview/Sequences/Contacts/Activity)
- [ ] Export to PDF generates file
- [ ] Export to CSV generates file
- [ ] Activity heatmap displays
- [ ] Goal tracker shows progress

### Settings Page
- [ ] Profile settings load
- [ ] Update profile succeeds
- [ ] Gmail integration works
- [ ] Outlook integration works
- [ ] Theme toggle works (light/dark)
- [ ] Keyboard shortcuts list displays

## Data Validation

### Contact Creation
- [ ] Required fields enforce validation
- [ ] Email format validation
- [ ] Duplicate contact prevention
- [ ] Invalid data shows errors
- [ ] Success toast on save

### Sequence Creation
- [ ] Template name required
- [ ] Subject line required
- [ ] Body required
- [ ] Variables autocomplete
- [ ] Preview shows rendered template

### Draft Generation
- [ ] Variables replace correctly
- [ ] Special characters escape
- [ ] Long content doesn't break layout
- [ ] Multiple contacts generate multiple drafts

## Error Handling

### Network Errors
- [ ] Offline mode shows error message
- [ ] Failed API calls show toast
- [ ] Retry button works
- [ ] Loading states show during requests
- [ ] Timeout handles gracefully (>30s)

### Invalid Data
- [ ] Empty forms show validation
- [ ] Invalid email shows error
- [ ] SQL injection prevented
- [ ] XSS attempts sanitized

### Edge Cases
- [ ] 0 contacts shows empty state
- [ ] 0 sequences shows empty state
- [ ] 0 drafts shows empty state
- [ ] Very long names don't overflow
- [ ] Very large datasets paginate (100+ contacts)

## Mobile Testing

### Responsive Design
- [ ] Mobile menu (hamburger) works
- [ ] Tables stack on mobile
- [ ] Cards stack on mobile
- [ ] Touch targets ≥44px
- [ ] Horizontal scroll disabled
- [ ] Charts resize responsively

### Mobile Safari (iPhone)
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] Buttons tappable
- [ ] No layout issues

### Mobile Chrome (Android)
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] Buttons tappable
- [ ] No layout issues

## Performance Testing

### Load Times
- [ ] Homepage loads <2s
- [ ] Dashboard loads <3s
- [ ] Contacts page loads <3s (100 contacts)
- [ ] Analytics page loads <5s
- [ ] Images lazy load

### Interactions
- [ ] Button clicks respond <100ms
- [ ] Form submissions <500ms
- [ ] Search results <300ms
- [ ] Chart rendering <2s

### Network Throttling
- [ ] Test on "Slow 3G"
- [ ] Loading states show
- [ ] No timeout errors

## Security Testing

### Authentication
- [ ] Unauthenticated users redirect to login
- [ ] Session expires after inactivity
- [ ] Logout clears session
- [ ] Password reset works

### Authorization
- [ ] Users only see their own data
- [ ] RLS policies enforce isolation
- [ ] API endpoints require auth

### Data Protection
- [ ] Passwords hashed (not visible)
- [ ] API keys not exposed in client
- [ ] HTTPS enforced
- [ ] CSRF tokens present

### Input Validation
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] File upload restrictions work
- [ ] Rate limiting prevents abuse

## Cross-Browser Testing

### Chrome (Latest)
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth
- [ ] Extension compatible

### Firefox (Latest)
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

### Safari (Latest)
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

### Edge (Latest)
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth
- [ ] Extension compatible

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab order logical
- [ ] All interactive elements focusable
- [ ] Focus indicators visible
- [ ] Esc closes modals
- [ ] Enter submits forms

### Screen Reader
- [ ] VoiceOver (Mac) announces elements
- [ ] NVDA (Windows) announces elements
- [ ] Alt text on images
- [ ] ARIA labels present
- [ ] Headings hierarchical (h1 → h6)

### Color Contrast
- [ ] Text readable on backgrounds
- [ ] WCAG AA compliance (4.5:1)
- [ ] Dark mode readable

### Motion
- [ ] Respects prefers-reduced-motion
- [ ] Animations can be disabled

## Data Integrity

### Export/Import
- [ ] Export preserves all fields
- [ ] Import handles CSV correctly
- [ ] Large exports complete (1000+ rows)
- [ ] Special characters preserved

### Sync
- [ ] Extension → Dashboard sync reliable
- [ ] Updates propagate within 5s
- [ ] No data loss on errors
- [ ] Offline changes queue

## Regression Testing

After each major change, re-test:

- [ ] User signup flow
- [ ] Contact creation
- [ ] Sequence creation
- [ ] Draft generation
- [ ] Analytics display
- [ ] Export functionality

## Pre-Release Checklist

- [ ] All automated tests pass
- [ ] Manual QA completed
- [ ] No critical bugs
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Database migrations tested
- [ ] Backup created
- [ ] Rollback plan ready

## Post-Release Monitoring

Within 24 hours of release:

- [ ] Monitor error tracking (Sentry)
- [ ] Check analytics for anomalies
- [ ] Review user feedback
- [ ] Verify key metrics (DAU, conversions)
- [ ] Ensure email deliverability

## Testing Notes

**Date**: ________________
**Tester**: ________________
**Version**: ________________
**Environment**: ________________

**Issues Found**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Sign-off**: ________________
