# 📦 Bulk Actions & Contact Management - Complete Guide

## 🎯 Overview

The Bulk Actions system allows you to:
- **Extract multiple LinkedIn profiles** in a row
- **Queue contacts** for later processing
- **Batch generate drafts** for all queued contacts
- **Review and edit** drafts before sending
- **Send multiple emails** via Gmail in bulk
- **Export contacts** and drafts to CSV

---

## 🚀 How It Works

### **Workflow Diagram**

```
Extract Profile #1
      ↓
[Add to Queue] or [Generate Now]
      ↓
Extract Profile #2
      ↓
[Add to Queue] or [Generate Now]
      ↓
... (repeat for 5, 10, 20 profiles)
      ↓
[Batch Generate All Drafts]
      ↓
Review drafts in Drafts View
      ↓
[Send All via Gmail]
      ↓
Done! 🎉
```

---

## 📋 Contact Queue System

### **Adding Contacts to Queue**

After extracting a LinkedIn profile with the magic workflow, you'll see:

```
┌─────────────────────────────────────┐
│  ✓ Contact Extracted & Draft Ready! │
├─────────────────────────────────────┤
│  [Contact Card]                      │
│  John Doe                            │
│  Recruiter at Google                 │
│                                      │
│  Subject: Connecting for...          │
│  Draft preview...                    │
├─────────────────────────────────────┤
│  [➕ Add to Queue]  [👁️ View & Send] │
└─────────────────────────────────────┘
```

**Two options:**
1. **Add to Queue** - Save for batch processing later
2. **View & Send Now** - Review and send immediately (original flow)

### **Queue Status Badges**

Contacts in the queue have status indicators:
- 🟡 **Pending** - Waiting for draft generation
- 🔵 **Generating** - Draft is being created
- 🟢 **Ready** - Draft ready to send
- ✅ **Sent** - Email has been sent
- 🔴 **Error** - Draft generation failed

### **Queue Actions**

For each contact in queue:
- ✨ **Generate Draft** - Generate draft for this contact only (pending)
- 👁️ **View Draft** - Preview the generated draft (ready)
- × **Remove** - Remove from queue

### **Bulk Queue Actions**

- **View Drafts** - Open the Drafts View to see all ready drafts
- **Generate All Drafts** - Batch generate for all pending contacts
- **Clear All** - Remove all contacts from queue

---

## ⚡ Batch Draft Generation

### **How It Works**

Click **"Generate All Drafts"** to process all pending contacts:

```
┌─────────────────────────────────────┐
│  Generating Drafts...                │
├─────────────────────────────────────┤
│  Generating draft for John Doe...   │
│  ████████████████░░░░  80%          │
│  4 / 5                               │
└─────────────────────────────────────┘
```

**Process:**
1. Shows progress modal
2. Generates draft for each contact sequentially
3. Rate-limited to avoid API throttling (2s between requests)
4. Handles errors gracefully (continues with next contact)
5. Shows summary when complete

**Performance:**
- **Speed:** ~2 seconds per contact
- **10 contacts:** ~20 seconds
- **50 contacts:** ~100 seconds (1.5 minutes)

### **Rate Limiting**

To avoid hitting API limits:
- 2-second delay between each draft generation
- ~30 drafts per minute maximum
- Respects API quota limits

### **Error Handling**

If a draft fails to generate:
- Contact marked with "Error" status
- Error message saved
- Batch continues with remaining contacts
- Summary shows success/failure count

---

## 📨 Drafts View

### **Access Drafts View**

Click **"📋 View Drafts"** button in the queue header.

### **Drafts View Layout**

```
┌─────────────────────────────────────┐
│  ← Back    Ready to Send (5)    ↻   │
├─────────────────────────────────────┤
│  Stats: 5 Ready | 2 Sent | 0 Pending│
├─────────────────────────────────────┤
│  [Ready (5)] [Sent (2)]              │
├─────────────────────────────────────┤
│  Draft Card #1                       │
│  John Doe - Recruiter at Google      │
│  Subject: ...                        │
│  Body preview...                     │
│  [📧 Send] [✏️ Edit] [📋 Copy] [🗑️]  │
├─────────────────────────────────────┤
│  Draft Card #2                       │
│  ...                                 │
├─────────────────────────────────────┤
│  [Send All via Gmail (5)]            │
│  [Export All (CSV)]                  │
└─────────────────────────────────────┘
```

### **Tabs**

- **Ready** - Drafts ready to send
- **Sent** - Previously sent drafts (history)

### **Draft Card Actions**

For each ready draft:
- **📧 Send via Gmail** - Open Gmail compose
- **✏️ Edit** - Modify subject/body
- **📋 Copy** - Copy to clipboard
- **🗑️ Delete** - Remove from queue

For sent drafts:
- **👁️ View** - View draft details
- **📋 Copy** - Copy to clipboard

---

## 🔄 Bulk Send

### **Send All via Gmail**

Click **"Send All via Gmail"** to:
1. Open Gmail compose tab for each draft
2. Pre-fill: To, Subject, Body
3. Mark as "Sent" in queue
4. Opens tabs in background (non-intrusive)

**Process:**
```
Opening Gmail for John Doe...
Opening Gmail for Jane Smith...
Opening Gmail for Mike Johnson...
...
✓ Opened 5 Gmail compose tabs!
```

**Rate Limiting:**
- 1 tab per second
- Background tabs (won't interrupt workflow)
- Can close/review before sending

**Confirmation:**
```
This will open 5 Gmail compose tabs. Continue?
[Cancel] [OK]
```

---

## 📥 Export to CSV

### **Export All Drafts**

Click **"Export All (CSV)"** to download a CSV file with:

**Columns:**
- First Name
- Last Name
- Company
- Role
- Email
- Status
- Subject
- Body
- Added At

**Use Cases:**
- Import into CRM (Salesforce, HubSpot)
- Share with team
- Backup contacts
- Email marketing tools

**Example CSV:**
```csv
First Name,Last Name,Company,Role,Email,Status,Subject,Body,Added At
John,Doe,Google,Recruiter,john.doe@google.com,Ready,"Connecting for...","Hi John,...","1/1/2026 10:30 AM"
```

---

## 🎨 UI Components

### **Contact Queue**

```html
<div class="contact-queue">
  <div class="queue-header">
    <h3>Contact Queue</h3>
    <span class="queue-count">5 contacts</span>
    <button id="clear-queue">🗑️</button>
  </div>

  <div class="queue-list">
    <!-- Queue items here -->
  </div>

  <div class="queue-footer">
    <button id="batch-generate">
      ✨ Generate All Drafts (3)
    </button>
  </div>
</div>
```

### **Draft Card**

```html
<div class="draft-card">
  <div class="draft-card-header">
    <div class="contact-avatar">JD</div>
    <div class="contact-details">
      <div class="contact-name">John Doe</div>
      <div class="contact-role">Recruiter</div>
      <div class="contact-company">Google</div>
    </div>
    <span class="draft-source">🤖 AI</span>
    <span class="draft-words">94 words</span>
  </div>

  <div class="draft-content">
    <div class="draft-subject">
      <strong>Subject:</strong> Connecting for...
    </div>
    <div class="draft-preview">
      Hi John, I came across your profile...
    </div>
  </div>

  <div class="draft-actions">
    <button>📧 Send via Gmail</button>
    <button>✏️ Edit</button>
    <button>📋 Copy</button>
    <button>🗑️ Delete</button>
  </div>
</div>
```

---

## 🔧 Technical Implementation

### **Storage Structure**

```javascript
// Chrome Storage Local
contactQueue: [
  {
    id: "abc123",
    firstName: "John",
    lastName: "Doe",
    company: "Google",
    role: "Recruiter",
    emails: [...],
    selectedEmail: "john.doe@google.com",
    status: "ready",
    draft: {
      subject: "...",
      body: "...",
      source: "ai",
      generatedAt: 1234567890
    },
    addedAt: 1234567890,
    sentAt: null,
    error: null
  },
  ...
]
```

### **Key Functions**

**Contact Queue Manager:**
```javascript
contactQueue.addToQueue(contact)
contactQueue.removeFromQueue(contactId)
contactQueue.clearQueue()
contactQueue.updateContactStatus(contactId, status, data)
contactQueue.getContactsByStatus(status)
contactQueue.batchGenerateDrafts(onProgress)
contactQueue.exportToCSV()
```

**Drafts View:**
```javascript
draftsView.render()
draftsView.sendViaGmail(contact)
draftsView.sendAllViaGmail()
draftsView.exportAllDrafts()
draftsView.editDraft(contact)
draftsView.copyDraft(contact)
```

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Queue capacity | 50 contacts max |
| Draft generation | ~2s per contact |
| Batch processing | ~30 contacts/min |
| CSV export | Instant |
| Send all (Gmail) | 1 tab/second |

---

## 🎯 Use Cases

### **Use Case 1: Mass Recruiter Outreach**

**Scenario:** Apply to 20 companies at once

**Steps:**
1. Visit LinkedIn profiles of 20 recruiters
2. Extract each profile → Add to queue
3. Batch generate all 20 drafts (~40 seconds)
4. Review drafts in Drafts View
5. Edit 2-3 drafts that need personalization
6. Send all via Gmail (20 tabs in 20 seconds)
7. Done!

**Time:** ~5 minutes (vs. ~1 hour manually)

---

### **Use Case 2: Weekly Networking**

**Scenario:** Reach out to 10 people weekly

**Steps:**
1. Monday: Extract 10 profiles → Add to queue
2. Tuesday: Batch generate drafts
3. Wednesday: Review and edit
4. Thursday: Send 5 drafts
5. Friday: Send remaining 5 drafts

**Benefit:** Spread workload, avoid spam flags

---

### **Use Case 3: Team Collaboration**

**Scenario:** Share contact list with team

**Steps:**
1. Extract 30 potential clients
2. Add to queue
3. Batch generate drafts
4. Export to CSV
5. Share CSV with sales team
6. Team imports to CRM

**Benefit:** Centralized contact management

---

## ⚠️ Best Practices

### **Do:**
- ✅ Extract in batches of 10-20 at a time
- ✅ Review drafts before sending
- ✅ Personalize important contacts
- ✅ Use queue for planning weekly outreach
- ✅ Export backups regularly

### **Don't:**
- ❌ Send all drafts without reviewing
- ❌ Extract 100+ profiles at once (rate limits)
- ❌ Use generic templates for key contacts
- ❌ Ignore error messages
- ❌ Spam the same person multiple times

---

## 🐛 Troubleshooting

### **"Queue is full"**
- **Cause:** 50 contact limit reached
- **Fix:** Clear queue or send/delete old contacts

### **"Draft generation failed"**
- **Cause:** API timeout or network error
- **Fix:** Retry individual contact generation

### **"No pending contacts"**
- **Cause:** All contacts already have drafts
- **Fix:** Add more contacts or clear queue

### **Gmail tabs not opening**
- **Cause:** Popup blocker
- **Fix:** Allow popups for the extension

---

## 🎉 Summary

**Bulk Actions delivers:**
- ✅ 10x faster outreach
- ✅ Queue management for planning
- ✅ Batch processing with progress tracking
- ✅ Drafts review before sending
- ✅ Multi-platform support (Gmail/Outlook/CSV)
- ✅ Error handling and rate limiting

**Result:** Go from 1 contact at a time → 20+ contacts in minutes! 🚀
