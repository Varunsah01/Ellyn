/**
 * Ellyn Storage Manager
 *
 * Comprehensive storage management using chrome.storage.local
 * Handles contacts, drafts, outreach status, settings, and cache
 *
 * STORAGE SCHEMA VERSION: 1
 * MAX QUOTA: ~5MB (chrome.storage.local limit)
 */

const STORAGE_VERSION = 1;
const MAX_CONTACTS_DEFAULT = 100;
const MAX_DRAFTS_PER_CONTACT = 10;
const STORAGE_WARNING_THRESHOLD = 0.8; // 80% usage warning

// ========================================
// UUID Generator
// ========================================

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ========================================
// CONTACTS MANAGEMENT
// ========================================

/**
 * Save a contact to storage
 * @param {Object} contactData - Contact information
 * @returns {Promise<Object>} Saved contact with ID and timestamps
 */
async function saveContact(contactData) {
  return new Promise(async (resolve, reject) => {
    try {
      const storage = await chrome.storage.local.get(['contacts', 'settings']);
      const contacts = storage.contacts || [];
      const settings = storage.settings || {};

      // Check if contact already exists (by LinkedIn URL or email)
      const existingIndex = contacts.findIndex(c =>
        c.linkedinUrl === contactData.linkedinUrl ||
        c.inferredEmail === contactData.inferredEmail
      );

      const now = new Date().toISOString();
      const contact = {
        id: existingIndex >= 0 ? contacts[existingIndex].id : `contact-${generateUUID()}`,
        name: contactData.name || '',
        role: contactData.role || '',
        company: contactData.company || '',
        domain: contactData.domain || extractDomain(contactData.inferredEmail),
        inferredEmail: contactData.inferredEmail || '',
        confirmedEmail: contactData.confirmedEmail || null,
        linkedinUrl: contactData.linkedinUrl || '',
        tags: contactData.tags || [],
        notes: contactData.notes || '',
        source: contactData.source || 'extension',
        createdAt: existingIndex >= 0 ? contacts[existingIndex].createdAt : now,
        updatedAt: now
      };

      if (existingIndex >= 0) {
        // Update existing contact
        contacts[existingIndex] = contact;
        console.log('[Storage] Contact updated:', contact.id);
      } else {
        // Add new contact
        contacts.unshift(contact);
        console.log('[Storage] Contact saved:', contact.id);
      }

      // Limit total contacts (default 100)
      const maxContacts = settings.maxContacts || MAX_CONTACTS_DEFAULT;
      const limitedContacts = contacts.slice(0, maxContacts);

      await chrome.storage.local.set({ contacts: limitedContacts });

      // Check storage quota
      await checkStorageQuota();

      resolve(contact);
    } catch (error) {
      console.error('[Storage] Error saving contact:', error);
      reject(error);
    }
  });
}

/**
 * Get a specific contact by ID
 */
async function getContact(contactId) {
  const storage = await chrome.storage.local.get(['contacts']);
  const contacts = storage.contacts || [];
  return contacts.find(c => c.id === contactId) || null;
}

/**
 * Get all contacts
 */
async function getAllContacts() {
  const storage = await chrome.storage.local.get(['contacts']);
  return storage.contacts || [];
}

/**
 * Get recent contacts (limit 5 by default)
 */
async function getRecentContacts(limit = 5) {
  const contacts = await getAllContacts();
  return contacts.slice(0, limit);
}

/**
 * Update a contact
 */
async function updateContact(contactId, updates) {
  const storage = await chrome.storage.local.get(['contacts']);
  const contacts = storage.contacts || [];

  const index = contacts.findIndex(c => c.id === contactId);
  if (index === -1) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  contacts[index] = {
    ...contacts[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ contacts });
  console.log('[Storage] Contact updated:', contactId);

  return contacts[index];
}

/**
 * Delete a contact
 */
async function deleteContact(contactId) {
  const storage = await chrome.storage.local.get(['contacts', 'drafts', 'outreach']);
  const contacts = storage.contacts || [];
  const drafts = storage.drafts || [];
  const outreach = storage.outreach || [];

  // Remove contact
  const filtered = contacts.filter(c => c.id !== contactId);

  // Remove associated drafts
  const filteredDrafts = drafts.filter(d => d.contactId !== contactId);

  // Remove outreach status
  const filteredOutreach = outreach.filter(o => o.contactId !== contactId);

  await chrome.storage.local.set({
    contacts: filtered,
    drafts: filteredDrafts,
    outreach: filteredOutreach
  });

  console.log('[Storage] Contact deleted:', contactId);
  return true;
}

/**
 * Search contacts by name or company
 */
async function searchContacts(query) {
  const contacts = await getAllContacts();
  const lowerQuery = query.toLowerCase();

  return contacts.filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    c.company.toLowerCase().includes(lowerQuery) ||
    c.role.toLowerCase().includes(lowerQuery) ||
    c.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// ========================================
// DRAFTS MANAGEMENT
// ========================================

/**
 * Save a draft
 */
async function saveDraft(draftData) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];

  const now = new Date().toISOString();
  const draft = {
    id: `draft-${generateUUID()}`,
    contactId: draftData.contactId || '',
    templateId: draftData.templateId || 'custom',
    subject: draftData.subject || '',
    body: draftData.body || '',
    toEmail: draftData.toEmail || '',
    status: draftData.status || 'draft', // draft, opened, sent
    metadata: draftData.metadata || {}, // AI generation info, etc.
    createdAt: now,
    updatedAt: now,
    sentAt: null
  };

  drafts.unshift(draft);

  // Limit drafts per contact
  const contactDrafts = drafts.filter(d => d.contactId === draft.contactId);
  if (contactDrafts.length > MAX_DRAFTS_PER_CONTACT) {
    // Remove oldest drafts for this contact
    const draftIdsToKeep = contactDrafts
      .slice(0, MAX_DRAFTS_PER_CONTACT)
      .map(d => d.id);

    const filtered = drafts.filter(d =>
      d.contactId !== draft.contactId || draftIdsToKeep.includes(d.id)
    );

    await chrome.storage.local.set({ drafts: filtered });
  } else {
    await chrome.storage.local.set({ drafts });
  }

  console.log('[Storage] Draft saved:', draft.id);
  return draft;
}

/**
 * Get a specific draft
 */
async function getDraft(draftId) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];
  return drafts.find(d => d.id === draftId) || null;
}

/**
 * Get all drafts for a contact
 */
async function getDraftsByContact(contactId) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];
  return drafts.filter(d => d.contactId === contactId);
}

/**
 * Get all drafts
 */
async function getAllDrafts() {
  const storage = await chrome.storage.local.get(['drafts']);
  return storage.drafts || [];
}

/**
 * Update draft status
 */
async function updateDraftStatus(draftId, status) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];

  const index = drafts.findIndex(d => d.id === draftId);
  if (index === -1) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  drafts[index].status = status;
  drafts[index].updatedAt = new Date().toISOString();

  if (status === 'sent') {
    drafts[index].sentAt = new Date().toISOString();
  }

  await chrome.storage.local.set({ drafts });
  console.log('[Storage] Draft status updated:', draftId, status);

  return drafts[index];
}

/**
 * Delete a draft
 */
async function deleteDraft(draftId) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];

  const filtered = drafts.filter(d => d.id !== draftId);
  await chrome.storage.local.set({ drafts: filtered });

  console.log('[Storage] Draft deleted:', draftId);
  return true;
}

// ========================================
// OUTREACH STATUS MANAGEMENT
// ========================================

/**
 * Save outreach status
 */
async function saveOutreachStatus(statusData) {
  const storage = await chrome.storage.local.get(['outreach']);
  const outreach = storage.outreach || [];

  const existingIndex = outreach.findIndex(o => o.contactId === statusData.contactId);

  const status = {
    contactId: statusData.contactId,
    draftId: statusData.draftId || null,
    status: statusData.status || 'drafted', // drafted, sent, replied, no-response
    lastUpdatedAt: new Date().toISOString(),
    notes: statusData.notes || ''
  };

  if (existingIndex >= 0) {
    outreach[existingIndex] = status;
  } else {
    outreach.push(status);
  }

  await chrome.storage.local.set({ outreach });
  console.log('[Storage] Outreach status saved:', status.contactId);

  return status;
}

/**
 * Get outreach status for a contact
 */
async function getOutreachStatus(contactId) {
  const storage = await chrome.storage.local.get(['outreach']);
  const outreach = storage.outreach || [];
  return outreach.find(o => o.contactId === contactId) || null;
}

/**
 * Update outreach status
 */
async function updateOutreachStatus(contactId, updates) {
  const storage = await chrome.storage.local.get(['outreach']);
  const outreach = storage.outreach || [];

  const index = outreach.findIndex(o => o.contactId === contactId);

  if (index === -1) {
    // Create new if doesn't exist
    return await saveOutreachStatus({ contactId, ...updates });
  }

  outreach[index] = {
    ...outreach[index],
    ...updates,
    lastUpdatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ outreach });
  console.log('[Storage] Outreach status updated:', contactId);

  return outreach[index];
}

// ========================================
// SETTINGS MANAGEMENT
// ========================================

/**
 * Get all settings
 */
async function getSettings() {
  const storage = await chrome.storage.local.get(['settings']);
  return storage.settings || {
    user: {
      name: '',
      role: '',
      school: ''
    },
    preferences: {
      emailClient: 'gmail',
      outlookVersion: 'personal',
      maxContacts: MAX_CONTACTS_DEFAULT,
      autoDeleteDraftsAfterDays: 30
    },
    cache: {
      domains: {},
      patterns: {}
    }
  };
}

/**
 * Update settings
 */
async function updateSettings(updates) {
  const settings = await getSettings();
  const newSettings = deepMerge(settings, updates);

  await chrome.storage.local.set({ settings: newSettings });
  console.log('[Storage] Settings updated');

  return newSettings;
}

/**
 * Get a specific setting
 */
async function getSetting(key) {
  const settings = await getSettings();
  return getNestedValue(settings, key);
}

/**
 * Set a specific setting
 */
async function setSetting(key, value) {
  const settings = await getSettings();
  setNestedValue(settings, key, value);

  await chrome.storage.local.set({ settings });
  console.log('[Storage] Setting updated:', key);

  return settings;
}

// ========================================
// CACHE MANAGEMENT (for email inference)
// ========================================

/**
 * Get cached domain for a company
 */
async function getCachedDomain(company) {
  const settings = await getSettings();
  const normalized = company.toLowerCase().trim();
  return settings.cache?.domains?.[normalized] || null;
}

/**
 * Cache a company -> domain mapping
 */
async function cacheDomain(company, domain) {
  const settings = await getSettings();
  const normalized = company.toLowerCase().trim();

  if (!settings.cache) settings.cache = {};
  if (!settings.cache.domains) settings.cache.domains = {};

  settings.cache.domains[normalized] = domain;

  await chrome.storage.local.set({ settings });
  console.log('[Storage] Domain cached:', company, '→', domain);

  return true;
}

/**
 * Get cached pattern for a domain
 */
async function getCachedPattern(domain) {
  const settings = await getSettings();
  return settings.cache?.patterns?.[domain] || null;
}

/**
 * Cache a domain -> pattern mapping
 */
async function cachePattern(domain, pattern) {
  const settings = await getSettings();

  if (!settings.cache) settings.cache = {};
  if (!settings.cache.patterns) settings.cache.patterns = {};

  settings.cache.patterns[domain] = pattern;

  await chrome.storage.local.set({ settings });
  console.log('[Storage] Pattern cached:', domain, '→', pattern);

  return true;
}

/**
 * Clear all cache
 */
async function clearCache() {
  const settings = await getSettings();
  settings.cache = { domains: {}, patterns: {} };

  await chrome.storage.local.set({ settings });
  console.log('[Storage] Cache cleared');

  return true;
}

// ========================================
// INFERENCE CACHE (backwards compatibility)
// ========================================

/**
 * Get inference cache (legacy support)
 */
async function getInferenceCache() {
  const settings = await getSettings();
  return {
    domainCache: settings.cache?.domains || {},
    patternCache: settings.cache?.patterns || {}
  };
}

/**
 * Save inference cache (legacy support)
 */
async function saveInferenceCache(cache) {
  const settings = await getSettings();

  if (!settings.cache) settings.cache = {};
  settings.cache.domains = cache.domainCache || {};
  settings.cache.patterns = cache.patternCache || {};

  await chrome.storage.local.set({ settings });
  console.log('[Storage] Inference cache saved');

  return true;
}

/**
 * Cache domain mapping (legacy support)
 */
async function cacheDomainMapping(company, domain) {
  return await cacheDomain(company, domain);
}

/**
 * Cache email pattern (legacy support)
 */
async function cacheEmailPattern(domain, pattern) {
  return await cachePattern(domain, pattern);
}

/**
 * Clear inference cache (legacy support)
 */
async function clearInferenceCache() {
  return await clearCache();
}

// ========================================
// QUOTA MANAGEMENT
// ========================================

/**
 * Get storage usage information
 */
async function getStorageStats() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.getBytesInUse(null, function(bytesInUse) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const maxBytes = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        const percentUsed = (bytesInUse / maxBytes) * 100;

        resolve({
          bytesInUse,
          maxBytes,
          percentUsed: percentUsed.toFixed(2),
          mbUsed: (bytesInUse / 1024 / 1024).toFixed(2),
          mbMax: (maxBytes / 1024 / 1024).toFixed(2),
          warning: percentUsed >= (STORAGE_WARNING_THRESHOLD * 100)
        });
      }
    });
  });
}

/**
 * Check storage quota and warn if approaching limit
 */
async function checkStorageQuota() {
  const stats = await getStorageStats();

  if (stats.warning) {
    console.warn(`[Storage] WARNING: Using ${stats.percentUsed}% of storage quota (${stats.mbUsed}MB / ${stats.mbMax}MB)`);

    // Trigger warning event
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: stats }));
    }
  }

  return stats;
}

/**
 * Clear old drafts to free up space
 */
async function clearOldDrafts(daysOld = 30) {
  const storage = await chrome.storage.local.get(['drafts']);
  const drafts = storage.drafts || [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const filtered = drafts.filter(d => {
    const draftDate = new Date(d.createdAt);
    return draftDate > cutoffDate || d.status === 'draft'; // Keep recent and unsent drafts
  });

  const removed = drafts.length - filtered.length;

  await chrome.storage.local.set({ drafts: filtered });
  console.log(`[Storage] Cleared ${removed} old drafts`);

  return removed;
}

// ========================================
// DATA EXPORT
// ========================================

/**
 * Export all data as JSON
 */
async function exportAllData() {
  const data = await chrome.storage.local.get(null);

  return {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    data: data
  };
}

/**
 * Import data from JSON
 */
async function importAllData(importData) {
  if (importData.version !== STORAGE_VERSION) {
    console.warn('[Storage] Version mismatch:', importData.version, 'vs', STORAGE_VERSION);
    // TODO: Implement migration
  }

  await chrome.storage.local.set(importData.data);
  console.log('[Storage] Data imported successfully');

  return true;
}

// ========================================
// MIGRATION
// ========================================

/**
 * Initialize storage and run migrations if needed
 */
async function initializeStorage() {
  const storage = await chrome.storage.local.get(['storageVersion']);
  const currentVersion = storage.storageVersion || 0;

  if (currentVersion < STORAGE_VERSION) {
    console.log('[Storage] Migrating from version', currentVersion, 'to', STORAGE_VERSION);
    await migrateStorage(currentVersion, STORAGE_VERSION);
    await chrome.storage.local.set({ storageVersion: STORAGE_VERSION });
  }

  console.log('[Storage] Initialized (version', STORAGE_VERSION, ')');
}

/**
 * Migrate storage between versions
 */
async function migrateStorage(oldVersion, newVersion) {
  console.log('[Storage] Running migration:', oldVersion, '→', newVersion);

  // Version 0 → 1: Restructure contacts and add new fields
  if (oldVersion === 0 && newVersion >= 1) {
    const storage = await chrome.storage.local.get(['contacts']);
    const oldContacts = storage.contacts || [];

    const newContacts = oldContacts.map(c => ({
      id: c.id || `contact-${generateUUID()}`,
      name: c.name || '',
      role: c.role || '',
      company: c.company || '',
      domain: extractDomain(c.selectedEmail || c.inferredEmail),
      inferredEmail: c.selectedEmail || c.inferredEmail || '',
      confirmedEmail: null,
      linkedinUrl: c.linkedinUrl || '',
      tags: c.tags || [],
      notes: c.notes || '',
      source: 'extension',
      createdAt: c.savedAt || c.timestamp || new Date().toISOString(),
      updatedAt: c.savedAt || c.timestamp || new Date().toISOString()
    }));

    await chrome.storage.local.set({ contacts: newContacts });
    console.log('[Storage] Migrated', newContacts.length, 'contacts');
  }

  // Future migrations go here
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Extract domain from email
 */
function extractDomain(email) {
  if (!email) return '';
  const match = email.match(/@(.+)$/);
  return match ? match[1] : '';
}

/**
 * Deep merge objects
 */
function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

/**
 * Get nested value from object
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);

  target[lastKey] = value;
}

// ========================================
// LEGACY SUPPORT (keep for backwards compatibility)
// ========================================

/**
 * Generate ID (legacy)
 */
function generateId() {
  return `contact-${generateUUID()}`;
}

// ========================================
// EXPORTS
// ========================================

window.Storage = {
  // Contacts
  saveContact,
  getContact,
  getAllContacts,
  getRecentContacts,
  updateContact,
  deleteContact,
  searchContacts,

  // Drafts
  saveDraft,
  getDraft,
  getDraftsByContact,
  getAllDrafts,
  updateDraftStatus,
  deleteDraft,

  // Outreach
  saveOutreachStatus,
  getOutreachStatus,
  updateOutreachStatus,

  // Settings
  getSettings,
  updateSettings,
  getSetting,
  setSetting,

  // Cache
  getCachedDomain,
  cacheDomain,
  getCachedPattern,
  cachePattern,
  clearCache,

  // Inference Cache (legacy)
  getInferenceCache,
  saveInferenceCache,
  cacheDomainMapping,
  cacheEmailPattern,
  clearInferenceCache,

  // Quota Management
  getStorageStats,
  checkStorageQuota,
  clearOldDrafts,

  // Data Management
  exportAllData,
  importAllData,
  initializeStorage,

  // Utilities
  generateUUID
};

// Initialize storage on load
initializeStorage().catch(err => {
  console.error('[Storage] Initialization error:', err);
});

console.log('[Storage] Module loaded (version', STORAGE_VERSION, ')');
