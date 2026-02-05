# Storage & Contact Management - Implementation Summary

## ✅ Completed Components

### 1. **storage.js** - Complete Storage Manager (800+ lines)

**Implemented Features:**
- ✅ Contact CRUD operations (Create, Read, Update, Delete)
- ✅ Draft management with contact linking
- ✅ Outreach status tracking
- ✅ Settings management with nested key support
- ✅ Domain and pattern caching for email inference
- ✅ Storage quota monitoring (warns at 80%)
- ✅ Automatic data migration system
- ✅ Old draft cleanup (configurable days)
- ✅ Data export/import (JSON)
- ✅ Backwards compatibility with existing code

**Data Structures:**

```javascript
// Contact
{
  id: "contact-{uuid}",
  name: "John Doe",
  role: "Senior Software Engineer",
  company: "TechCorp",
  domain: "techcorp.com",
  inferredEmail: "john.doe@techcorp.com",
  confirmedEmail: null,
  linkedinUrl: "https://linkedin.com/in/johndoe",
  tags: ["software", "referral-target"],
  notes: "",
  source: "extension",
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-15T10:30:00Z"
}

// Draft
{
  id: "draft-{uuid}",
  contactId: "contact-{uuid}",
  templateId: "general-referral",
  subject: "...",
  body: "...",
  toEmail: "...",
  status: "draft", // draft, opened, sent
  metadata: {},
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-15T10:30:00Z",
  sentAt: null
}

// Outreach Status
{
  contactId: "contact-{uuid}",
  draftId: "draft-{uuid}",
  status: "sent", // drafted, sent, replied, no-response
  lastUpdatedAt: "2025-01-15T10:30:00Z",
  notes: ""
}

// Settings
{
  user: {
    name: "",
    role: "",
    school: ""
  },
  preferences: {
    emailClient: "gmail",
    outlookVersion: "personal",
    maxContacts: 100,
    autoDeleteDraftsAfterDays: 30
  },
  cache: {
    domains: {},
    patterns: {}
  }
}
```

**API Methods:**

```javascript
// Contacts
await Storage.saveContact(contactData)
await Storage.getContact(contactId)
await Storage.getAllContacts()
await Storage.getRecentContacts(limit)
await Storage.updateContact(contactId, updates)
await Storage.deleteContact(contactId)
await Storage.searchContacts(query)

// Drafts
await Storage.saveDraft(draftData)
await Storage.getDraft(draftId)
await Storage.getDraftsByContact(contactId)
await Storage.getAllDrafts()
await Storage.updateDraftStatus(draftId, status)
await Storage.deleteDraft(draftId)

// Outreach
await Storage.saveOutreachStatus(statusData)
await Storage.getOutreachStatus(contactId)
await Storage.updateOutreachStatus(contactId, updates)

// Settings
await Storage.getSettings()
await Storage.updateSettings(updates)
await Storage.getSetting(key)
await Storage.setSetting(key, value)

// Cache
await Storage.getCachedDomain(company)
await Storage.cacheDomain(company, domain)
await Storage.getCachedPattern(domain)
await Storage.cachePattern(domain, pattern)
await Storage.clearCache()

// Quota Management
await Storage.getStorageStats()
await Storage.checkStorageQuota()
await Storage.clearOldDrafts(daysOld)

// Data Management
await Storage.exportAllData()
await Storage.importAllData(data)
```

### 2. **export.js** - Export/Import Utility (500+ lines)

**Implemented Features:**
- ✅ CSV export for contacts, drafts, outreach
- ✅ JSON export for full backups
- ✅ CSV import for contacts
- ✅ JSON import for full restore
- ✅ Automatic file download
- ✅ Proper CSV escaping (handles commas, quotes, newlines)
- ✅ Date formatting

**Export Functions:**

```javascript
// CSV Exports
await ExportUtil.downloadContactsCSV()
await ExportUtil.downloadDraftsCSV()
await ExportUtil.downloadOutreachCSV()

// JSON Exports
await ExportUtil.downloadBackupJSON()
await ExportUtil.exportContactsToJSON()
await ExportUtil.exportAllDataToJSON()

// Import
await ExportUtil.importFromJSON(file)
await ExportUtil.importContactsFromCSV(file)
```

**CSV Format:**

```csv
Name,Role,Company,Domain,Inferred Email,Confirmed Email,LinkedIn URL,Tags,Notes,Source,Date Added,Last Updated
John Doe,Senior SWE,TechCorp,techcorp.com,john.doe@techcorp.com,,linkedin.com/in/johndoe,software; referral-target,,extension,Jan 15 2025,Jan 15 2025
```

---

## 📋 Remaining Implementation Tasks

### 3. Contact Detail View (`contact-detail.js`) - NOT YET IMPLEMENTED

**Required:**

```javascript
class ContactDetailView {
  constructor(contactId) {
    this.contactId = contactId;
    this.contact = null;
    this.drafts = [];
    this.outreach = null;
  }

  async load() {
    this.contact = await Storage.getContact(this.contactId);
    this.drafts = await Storage.getDraftsByContact(this.contactId);
    this.outreach = await Storage.getOutreachStatus(this.contactId);
  }

  render() {
    // Create modal HTML
    // Show contact details
    // Show drafts list
    // Show notes (editable)
    // Allow draft creation
    // Allow contact deletion
  }

  async saveNotes(notes) {
    await Storage.updateContact(this.contactId, { notes });
  }

  async updateStatus(status) {
    await Storage.updateOutreachStatus(this.contactId, { status });
  }

  async createNewDraft() {
    // Open AI generation or template with this contact
  }

  async deleteContact() {
    if (confirm('Delete this contact and all drafts?')) {
      await Storage.deleteContact(this.contactId);
      this.close();
    }
  }
}
```

**UI Structure:**

```html
<div id="contact-detail-modal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <button class="back-btn">← Back</button>
      <h3>Contact Details</h3>
      <button class="close-btn">×</button>
    </div>

    <div class="modal-body">
      <div class="contact-info">
        <div class="contact-avatar">{initials}</div>
        <h2>{name}</h2>
        <p class="role">{role}</p>
        <p class="company">{company}</p>
      </div>

      <div class="contact-details">
        <div class="detail-row">
          <label>Email:</label>
          <span>{email}</span>
          <button class="copy-btn">Copy</button>
        </div>
        <div class="detail-row">
          <label>LinkedIn:</label>
          <a href="{linkedinUrl}" target="_blank">View Profile</a>
        </div>
        <div class="detail-row">
          <label>Status:</label>
          <select id="outreach-status">
            <option value="drafted">Drafted</option>
            <option value="sent">Sent</option>
            <option value="replied">Replied</option>
            <option value="no-response">No Response</option>
          </select>
        </div>
      </div>

      <div class="notes-section">
        <label>Notes:</label>
        <textarea id="contact-notes" rows="4"></textarea>
        <button id="save-notes-btn">Save Notes</button>
      </div>

      <div class="drafts-section">
        <h4>Drafts ({count})</h4>
        <div id="drafts-list">
          <!-- Draft items -->
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button id="create-draft-btn" class="btn btn-primary">Create New Draft</button>
      <button id="delete-contact-btn" class="btn btn-danger">Delete Contact</button>
    </div>
  </div>
</div>
```

### 4. Recent Contacts UI (Update `sidepanel.js`) - NOT YET IMPLEMENTED

**Update Recent Contacts Section:**

```javascript
async function loadRecentContacts() {
  const contacts = await Storage.getRecentContacts(5);
  const recentContactsList = document.getElementById('recent-contacts-list');

  if (contacts.length === 0) {
    recentContactsList.innerHTML = '<p class="empty-state">No recent contacts</p>';
    return;
  }

  recentContactsList.innerHTML = '';

  for (const contact of contacts) {
    const outreach = await Storage.getOutreachStatus(contact.id);
    const item = createContactListItem(contact, outreach);
    recentContactsList.appendChild(item);
  }
}

function createContactListItem(contact, outreach) {
  const item = document.createElement('div');
  item.className = 'recent-contact-item';

  const timeAgo = getTimeAgo(contact.updatedAt);
  const statusIcon = getStatusIcon(outreach?.status);
  const statusText = getStatusText(outreach?.status);

  item.innerHTML = `
    <div class="contact-avatar">${getInitials(contact.name)}</div>
    <div class="contact-info">
      <div class="contact-name">${contact.name}</div>
      <div class="contact-meta">
        <span class="company">${contact.company}</span>
        <span class="time-ago">${timeAgo}</span>
      </div>
      ${outreach ? `<div class="contact-status">${statusIcon} ${statusText}</div>` : ''}
    </div>
    <div class="contact-actions">
      <button class="btn-small" onclick="viewContact('${contact.id}')">View</button>
      ${outreach?.status !== 'sent' ? `<button class="btn-small" onclick="draftAgain('${contact.id}')">Draft</button>` : ''}
    </div>
  `;

  return item;
}

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getStatusIcon(status) {
  const icons = {
    'drafted': '📝',
    'sent': '✓',
    'replied': '↩️',
    'no-response': '⏳'
  };
  return icons[status] || '';
}

function getStatusText(status) {
  const texts = {
    'drafted': 'Draft',
    'sent': 'Sent',
    'replied': 'Replied',
    'no-response': 'No Response'
  };
  return texts[status] || '';
}

function viewContact(contactId) {
  const detail = new ContactDetailView(contactId);
  detail.show();
}

async function draftAgain(contactId) {
  const contact = await Storage.getContact(contactId);

  // Populate current contact
  currentContact = {
    fullName: contact.name,
    firstName: contact.name.split(' ')[0],
    lastName: contact.name.split(' ').slice(1).join(' '),
    currentRole: contact.role,
    companyName: contact.company,
    linkedinUrl: contact.linkedinUrl
  };

  selectedEmail = contact.inferredEmail || contact.confirmedEmail;

  // Show AI generation section
  document.getElementById('ai-draft-section')?.classList.remove('hidden');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

**CSS for Contact List:**

```css
.recent-contact-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
}

.recent-contact-item:hover {
  background: var(--gray-100);
  border-color: var(--primary-blue);
}

.contact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-blue), var(--primary-purple));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.contact-info {
  flex: 1;
}

.contact-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--gray-900);
  margin-bottom: 4px;
}

.contact-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--gray-600);
}

.contact-status {
  font-size: 12px;
  color: var(--gray-700);
  margin-top: 4px;
}

.contact-actions {
  display: flex;
  gap: 6px;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--gray-300);
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-small:hover {
  background: var(--primary-blue);
  color: white;
  border-color: var(--primary-blue);
}
```

### 5. Sync Status Indicator - NOT YET IMPLEMENTED

**Add to Header:**

```html
<header class="header">
  <div class="logo-container">
    <!-- existing logo -->
  </div>
  <div id="sync-status" class="sync-status" onclick="openSyncSettings()">
    <span id="sync-icon">☁️</span>
    <span id="sync-text">Synced</span>
  </div>
</header>
```

**Sync Status States:**

```javascript
const SyncStatus = {
  SYNCED: {
    icon: '☁️',
    text: 'Synced',
    class: 'synced'
  },
  SYNCING: {
    icon: '🔄',
    text: 'Syncing...',
    class: 'syncing'
  },
  NOT_SYNCED: {
    icon: '⚠️',
    text: 'Not synced',
    class: 'warning'
  },
  ERROR: {
    icon: '❌',
    text: 'Sync error',
    class: 'error'
  }
};

function updateSyncStatus(status) {
  const iconEl = document.getElementById('sync-icon');
  const textEl = document.getElementById('sync-text');
  const statusEl = document.getElementById('sync-status');

  if (iconEl) iconEl.textContent = status.icon;
  if (textEl) textEl.textContent = status.text;
  if (statusEl) {
    statusEl.className = `sync-status ${status.class}`;
  }
}

function openSyncSettings() {
  // Open modal explaining sync
  // Link to web app
  // Show local storage stats
}
```

**CSS:**

```css
.sync-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sync-status.synced {
  background: #d1fae5;
  color: #065f46;
}

.sync-status.syncing {
  background: #dbeafe;
  color: #1e40af;
  animation: pulse 1.5s infinite;
}

.sync-status.warning {
  background: #fef3c7;
  color: #92400e;
}

.sync-status.error {
  background: #fee2e2;
  color: #991b1b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

### 6. Storage Quota Warning UI - NOT YET IMPLEMENTED

**Listen for Quota Warnings:**

```javascript
window.addEventListener('storage-quota-warning', (event) => {
  const stats = event.detail;

  showQuotaWarning(stats);
});

function showQuotaWarning(stats) {
  const message = `
    Storage is ${stats.percentUsed}% full (${stats.mbUsed}MB / ${stats.mbMax}MB).

    Consider:
    • Exporting old contacts
    • Deleting old drafts
    • Clearing cache
  `;

  if (confirm(message + '\n\nOpen storage management?')) {
    showStorageManagement(stats);
  }
}

function showStorageManagement(stats) {
  // Show modal with storage breakdown
  // Offer to clear old drafts
  // Offer to export data
  // Show itemized usage (contacts, drafts, cache)
}
```

---

## 🧪 Testing Guide

### Contact Management Tests

```javascript
// Test 1: Save Contact
const contact = await Storage.saveContact({
  name: 'John Doe',
  role: 'Software Engineer',
  company: 'TechCorp',
  inferredEmail: 'john.doe@techcorp.com',
  linkedinUrl: 'https://linkedin.com/in/johndoe'
});
console.log('Saved:', contact);

// Test 2: Get Contact
const retrieved = await Storage.getContact(contact.id);
console.log('Retrieved:', retrieved);

// Test 3: Update Contact
const updated = await Storage.updateContact(contact.id, {
  notes: 'Met at conference',
  tags: ['referral', 'priority']
});
console.log('Updated:', updated);

// Test 4: Search
const results = await Storage.searchContacts('tech');
console.log('Search results:', results);

// Test 5: Delete
await Storage.deleteContact(contact.id);
console.log('Deleted');
```

### Draft Management Tests

```javascript
// Test 1: Save Draft
const draft = await Storage.saveDraft({
  contactId: contact.id,
  subject: 'Quick question',
  body: 'Hi John, ...',
  toEmail: 'john.doe@techcorp.com',
  templateId: 'cold-outreach'
});
console.log('Draft saved:', draft);

// Test 2: Get Drafts
const drafts = await Storage.getDraftsByContact(contact.id);
console.log('Contact drafts:', drafts);

// Test 3: Update Status
await Storage.updateDraftStatus(draft.id, 'sent');
console.log('Draft marked as sent');
```

### Export/Import Tests

```javascript
// Test 1: Export Contacts CSV
const result = await ExportUtil.downloadContactsCSV();
console.log('Exported:', result);

// Test 2: Export Backup JSON
await ExportUtil.downloadBackupJSON();
console.log('Backup created');

// Test 3: Import from File (requires file input)
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  const result = await ExportUtil.importFromJSON(file);
  console.log('Import result:', result);
};
fileInput.click();
```

### Storage Quota Tests

```javascript
// Test 1: Check Quota
const stats = await Storage.getStorageStats();
console.log('Storage:', stats);

// Test 2: Clear Old Drafts
const removed = await Storage.clearOldDrafts(30);
console.log('Removed drafts:', removed);
```

---

## 📊 Storage Usage Breakdown

**Estimated Sizes:**

- Contact (average): ~500 bytes
- Draft (average): ~1KB
- Outreach status: ~200 bytes
- Settings: ~2KB
- Cache (100 entries): ~10KB

**Example Capacity:**

- 5MB total
- ~5,000 contacts (without drafts)
- ~500 contacts with 2 drafts each
- ~100 contacts with 10 drafts each

---

## ✅ Implementation Status

| Component | Status | Lines | Priority |
|-----------|--------|-------|----------|
| storage.js | ✅ Complete | 836 | Critical |
| export.js | ✅ Complete | 500 | High |
| contact-detail.js | ❌ Not Started | ~300 | High |
| Recent Contacts UI | ❌ Not Started | ~200 | Medium |
| Sync Status | ❌ Not Started | ~100 | Low |
| Quota Warning UI | ❌ Not Started | ~150 | Medium |

**Total Completed:** 1,336 lines
**Total Remaining:** ~750 lines

---

## 🚀 Next Steps

1. **Immediate:** Test storage.js and export.js integration
2. **High Priority:** Implement contact-detail.js modal
3. **Medium Priority:** Update Recent Contacts UI with full features
4. **Low Priority:** Add sync status indicator and quota warnings

---

**Implementation Date:** 2025-01-15
**Version:** 1.0.0
**Status:** Core Complete, UI Pending
