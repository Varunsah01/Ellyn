# Analytics System - Testing Guide

## Quick Start

### 1. Load the Extension
```
1. Open Chrome
2. Go to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension folder
6. Open side panel
```

### 2. Generate Test Data
To properly test analytics, you need at least 5-10 emails tracked. Here's how:

**Option A: Use Magic Extract Button**
1. Visit LinkedIn profiles
2. Click "Extract & Generate Draft"
3. Click "Send via Gmail" (or Outlook/Copy)
4. Repeat 5-10 times with different profiles

**Option B: Manual Data Generation (for testing)**
```javascript
// Open DevTools console in sidepanel and run:

// Create test contact
const testContact = {
  id: 'test_' + Date.now(),
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp',
  role: 'Software Engineer',
  selectedEmail: 'john.doe@acme.com'
};

// Create test draft
const testDraft = {
  subject: 'Quick question about your background',
  body: 'Hi John, I noticed your experience at Acme Corp and wanted to reach out...',
  to: 'john.doe@acme.com',
  templateUsed: 'Referral Request',
  generatedByAI: true,
  aiModel: 'claude-3-sonnet-20240229',
  aiCost: 0.001
};

// Track email
await analyticsTracker.trackEmailSent(testContact, testDraft, 'gmail');

// Generate 10 test emails
for (let i = 0; i < 10; i++) {
  const contact = {
    id: 'test_' + Date.now() + '_' + i,
    firstName: 'Contact',
    lastName: i + 1,
    company: ['Google', 'Meta', 'Amazon', 'Apple'][i % 4],
    role: 'Engineer',
    selectedEmail: `contact${i+1}@company.com`
  };

  const draft = {
    subject: `Test email ${i+1}`,
    body: 'Test body with ' + (50 + Math.random() * 100) + ' words',
    to: contact.selectedEmail,
    templateUsed: ['Referral Request', 'Direct Outreach', 'Follow Up'][i % 3],
    generatedByAI: Math.random() > 0.3,
    aiModel: 'claude-3-sonnet-20240229',
    aiCost: 0.001
  };

  await analyticsTracker.trackEmailSent(contact, draft, ['gmail', 'outlook'][i % 2]);

  // Mark some as responded
  if (i % 3 === 0) {
    const history = await analyticsTracker.getHistory();
    await analyticsTracker.markResponse(
      history[0].id,
      ['positive', 'referral', 'negative'][i % 3]
    );
  }

  // Wait 100ms between entries
  await new Promise(resolve => setTimeout(resolve, 100));
}

console.log('Generated 10 test emails!');
```

---

## Test Scenarios

### ✅ Scenario 1: Email Tracking

**Test Gmail Send:**
1. Extract a LinkedIn profile
2. Click "Send via Gmail"
3. Gmail tab opens
4. Close Gmail tab
5. Click "📊 Analytics" tab
6. **Expected:** Email appears in Recent Activity
7. **Expected:** "Emails Sent" counter increments

**Test Outlook Send:**
1. Extract a profile
2. Click "Send via Outlook"
3. Outlook tab opens
4. Close Outlook tab
5. Check Analytics
6. **Expected:** Email tracked with "outlook" method

**Test Clipboard Copy:**
1. Extract a profile
2. Click "Copy to Clipboard"
3. Check Analytics
4. **Expected:** Email tracked with "clipboard" method

**Validation:**
- ✅ All 3 methods track emails
- ✅ Contact info captured correctly
- ✅ Template/AI info stored
- ✅ Timestamp recorded
- ✅ Word count calculated

---

### 📊 Scenario 2: Analytics Dashboard

**View Dashboard:**
1. Send at least 5 emails
2. Click "📊 Analytics" tab
3. **Expected:** Dashboard appears with 4 stat cards

**Stat Cards Display:**
- ✅ "Emails Sent" shows correct count
- ✅ "Responses" shows correct count
- ✅ "Referrals Offered" shows correct count
- ✅ "Total AI Cost" shows correct amount

**Weekly Comparison:**
- ✅ "This Week" shows emails sent in last 7 days
- ✅ "Last Week" shows emails from previous week
- ✅ Arrow shows trend (↗️ ↘️ →)
- ✅ Response rate % displayed

**Recent Activity:**
- ✅ Shows last 10 emails
- ✅ Status icons (📤 sent, ✅ responded)
- ✅ Time ago formatted correctly
- ✅ "Mark Response" button appears for untracked

---

### 💡 Scenario 3: Insights Generation

**Test Minimum Data Requirement:**
1. Clear all data (see below)
2. Send 1 email
3. Check Analytics
4. **Expected:** Shows "Send 4 more emails to unlock insights"

**Test Insights with 5+ Emails:**
1. Ensure 5+ emails sent
2. View Analytics
3. **Expected:** Insights section shows 1-5 insights
4. **Expected:** Insights are relevant (response rate, templates, etc.)

**Insight Types:**
- ✅ Response rate insights (if rate < 20%, warning)
- ✅ Template performance (if template has 3+ sends)
- ✅ Email length suggestions (if avg > 150 words)
- ✅ Send timing recommendations
- ✅ Personalization impact
- ✅ AI vs manual performance

**Validation:**
- ✅ Insights prioritized by importance
- ✅ Maximum 5 insights shown
- ✅ Color-coded appropriately (info, warning, success)
- ✅ Action links displayed

---

### 🏆 Scenario 4: Achievements

**Test Volume Achievements:**
1. Send 1 email
2. **Expected:** "📧 First Email" badge appears
3. Send 9 more emails (total 10)
4. **Expected:** "✉️ Getting Started" badge appears

**Test Response Achievements:**
1. Mark first email as "Positive Response"
2. **Expected:** "🎉 First Response" badge appears
3. Mark 9 more as positive (total 10)
4. **Expected:** "💬 Conversationalist" badge appears

**Test Referral Achievements:**
1. Mark first email as "Offered Referral"
2. **Expected:** "🤝 First Referral" badge appears

**Test View All:**
1. Click "View All X Achievements"
2. **Expected:** Modal opens with all badges
3. **Expected:** 2-column grid layout
4. Click overlay to close
5. **Expected:** Modal closes

**Validation:**
- ✅ Achievements unlock at correct thresholds
- ✅ Badges display with icon, name, description
- ✅ Hover effects work
- ✅ Modal opens/closes correctly

---

### 📬 Scenario 5: Response Tracking

**Track Positive Response:**
1. Find email in Recent Activity with status "Sent"
2. Click "Mark Response" button
3. **Expected:** Modal opens with 4 options
4. Click "✅ Positive Response"
5. **Expected:** Modal closes
6. **Expected:** Email status updates to "✅ Responded"
7. **Expected:** "Total Responses" counter increments
8. **Expected:** Response rate recalculates

**Track Referral:**
1. Find another sent email
2. Click "Mark Response"
3. Click "🎉 Offered Referral"
4. **Expected:** "Referrals Offered" counter increments
5. **Expected:** Response tracked correctly

**Track Declined:**
1. Mark an email as "❌ Declined"
2. **Expected:** Status updates but doesn't count as positive response

**Track No Response:**
1. Mark an email as "📭 No Response"
2. **Expected:** Status updates appropriately

**Response Tracker Prompt:**
1. If 3+ emails with status "sent"
2. **Expected:** Blue prompt box appears above Recent Activity
3. **Expected:** Shows top 3 unreplied contacts
4. **Expected:** "Mark Response" buttons available
5. Click button
6. **Expected:** Opens response modal

**Validation:**
- ✅ All 4 response types work
- ✅ Counters update instantly
- ✅ Response rate recalculates
- ✅ Time to response calculated (in hours)
- ✅ Success toast appears
- ✅ Response tracker prompt shows/hides appropriately

---

### 📥 Scenario 6: CSV Export

**Export Data:**
1. Have 10+ tracked emails
2. Click "📥 Export" button in dashboard
3. **Expected:** CSV file downloads
4. **Expected:** Filename is `ellyn-analytics-YYYY-MM-DD.csv`
5. Open CSV in Excel or Google Sheets
6. **Expected:** All columns present (15 columns)
7. **Expected:** All rows present (10+ data rows + 1 header)

**Verify CSV Contents:**
- ✅ Date column (formatted as MM/DD/YYYY)
- ✅ Contact Name, Company, Role
- ✅ Email address
- ✅ Subject (quoted if contains commas)
- ✅ Word Count
- ✅ Template name
- ✅ AI Generated (Yes/No)
- ✅ Send Method (gmail/outlook/clipboard)
- ✅ Status (sent/responded)
- ✅ Response Type (positive/negative/referral/N/A)
- ✅ Time to Response (hours or N/A)
- ✅ Day of Week (Monday, Tuesday, etc.)
- ✅ Hour Sent (12 AM, 10 AM, etc.)

**Validation:**
- ✅ CSV downloads successfully
- ✅ Opens in Excel/Sheets without errors
- ✅ All data accurate
- ✅ Commas in subject/content handled correctly

---

### 🔄 Scenario 7: Navigation Tabs

**Test Tab Switching:**
1. Send first email
2. **Expected:** Navigation tabs appear
3. **Expected:** Default tab is "📋 Queue" (active)
4. Click "📧 Drafts" tab
5. **Expected:** Drafts view shows, Queue hides
6. Click "📊 Analytics" tab
7. **Expected:** Analytics view shows, Drafts hides
8. Click "📋 Queue" tab
9. **Expected:** Queue view shows, Analytics hides

**Test Active State:**
1. Check active tab highlighting
2. **Expected:** Active tab has blue underline
3. **Expected:** Active tab text is bold
4. **Expected:** Only one tab active at a time

**Test Keyboard Navigation:**
1. Press Tab key repeatedly
2. **Expected:** Focus moves through tabs
3. Press Enter on focused tab
4. **Expected:** Tab activates and view switches

**Validation:**
- ✅ Tabs appear after first email
- ✅ Tab switching smooth (no flicker)
- ✅ Only one view visible at a time
- ✅ Active state correct
- ✅ Views render correctly on switch

---

## 🧪 Advanced Testing

### Test Data Persistence
```javascript
// Save current state
const stats = await analyticsTracker.getStats();
const history = await analyticsTracker.getHistory();

console.log('Stats:', stats);
console.log('History count:', history.length);

// Reload extension
// - Right-click extension icon → Reload

// Verify data persists
const newStats = await analyticsTracker.getStats();
const newHistory = await analyticsTracker.getHistory();

console.log('Stats match:', JSON.stringify(stats) === JSON.stringify(newStats));
console.log('History match:', history.length === newHistory.length);
```

### Test Storage Limits
```javascript
// Generate 500 emails (storage limit)
for (let i = 0; i < 500; i++) {
  await analyticsTracker.trackEmailSent(
    { id: 'test_' + i, firstName: 'Test', lastName: i, company: 'Test', role: 'Test', selectedEmail: 'test@test.com' },
    { subject: 'Test', body: 'Test', to: 'test@test.com', templateUsed: 'Test', generatedByAI: false, aiCost: 0 },
    'gmail'
  );
}

const history = await analyticsTracker.getHistory();
console.log('History count:', history.length); // Should be 500

// Track one more
await analyticsTracker.trackEmailSent(/* ... */);

const newHistory = await analyticsTracker.getHistory();
console.log('History count after 501st:', newHistory.length); // Should still be 500
```

### Test Insights Accuracy
```javascript
// Generate controlled dataset
// - 10 emails, template A
// - 8 responded (80% rate)
// Then generate 10 emails, template B
// - 2 responded (20% rate)

const insights = await analyticsInsights.generateInsights();
const templateInsight = insights.find(i => i.message.includes('template'));

console.log('Template insight:', templateInsight);
// Should recommend template A (80% rate)
```

---

## 🔧 Debugging Tools

### View All Tracked Data
```javascript
const history = await analyticsTracker.getHistory();
console.table(history);
```

### View Stats
```javascript
const stats = await analyticsTracker.getStats();
console.log(JSON.stringify(stats, null, 2));
```

### View Insights
```javascript
const insights = await analyticsInsights.generateInsights();
console.log(JSON.stringify(insights, null, 2));
```

### Clear All Data (Reset)
```javascript
await analyticsTracker.clearAllData();
console.log('All analytics data cleared!');
```

### View Storage Usage
```javascript
chrome.storage.local.getBytesInUse(['emailHistory', 'analyticsStats'], (bytes) => {
  console.log('Storage used:', (bytes / 1024).toFixed(2), 'KB');
});
```

---

## ✅ Complete Test Checklist

**Core Functionality:**
- [ ] Emails tracked on Gmail send
- [ ] Emails tracked on Outlook send
- [ ] Emails tracked on clipboard copy
- [ ] Contact info captured correctly
- [ ] Template/AI info stored
- [ ] Timestamps recorded accurately
- [ ] Word count calculated

**Dashboard:**
- [ ] All 4 stat cards display
- [ ] Counters show correct values
- [ ] Weekly comparison accurate
- [ ] Recent activity shows last 10
- [ ] Time ago formatted correctly
- [ ] Refresh button works

**Insights:**
- [ ] Requires 5+ emails before showing
- [ ] Generates relevant insights
- [ ] Prioritizes by importance
- [ ] Max 5 insights shown
- [ ] Color-coded appropriately
- [ ] Action links work

**Achievements:**
- [ ] Volume badges unlock correctly
- [ ] Response badges unlock correctly
- [ ] Referral badges unlock correctly
- [ ] Streak tracking works
- [ ] View all modal opens/closes

**Response Tracking:**
- [ ] Modal opens on button click
- [ ] All 4 response types work
- [ ] Counters update instantly
- [ ] Response rate recalculates
- [ ] Success toast appears
- [ ] Time to response calculated

**Export:**
- [ ] CSV downloads successfully
- [ ] Filename includes date
- [ ] All columns present
- [ ] All data accurate
- [ ] Opens in Excel/Sheets

**Navigation:**
- [ ] Tabs appear after first email
- [ ] Tab switching smooth
- [ ] Active state correct
- [ ] Views render on switch
- [ ] Keyboard accessible

**Performance:**
- [ ] Dashboard loads in <100ms
- [ ] Insights calculate in <50ms
- [ ] No memory leaks
- [ ] Data persists after reload
- [ ] Storage limit enforced (500 max)

---

## 🎯 Success Criteria

**Pass if:**
- ✅ All core functionality tests pass
- ✅ Dashboard displays all metrics correctly
- ✅ Insights generate and prioritize properly
- ✅ Response tracking is quick and accurate
- ✅ CSV export contains complete data
- ✅ No console errors during normal use
- ✅ Performance meets targets (<100ms load)

**Fail if:**
- ❌ Emails not tracked consistently
- ❌ Stats incorrect or not updating
- ❌ Insights not generating with 5+ emails
- ❌ Response tracking not saving
- ❌ CSV export missing data
- ❌ Console errors present
- ❌ Slow performance (>500ms operations)

---

Happy Testing! 🧪✨
