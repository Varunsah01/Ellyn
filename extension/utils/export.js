/**
 * Ellyn Export Utility
 *
 * Handles exporting contacts and data to CSV and JSON formats
 * Provides download functionality for backups
 */

// ========================================
// CSV Export
// ========================================

/**
 * Export contacts to CSV format
 * @param {Array} contacts - Array of contact objects
 * @returns {string} CSV formatted string
 */
function exportContactsToCSV(contacts) {
  if (!contacts || contacts.length === 0) {
    return 'No contacts to export';
  }

  // CSV Headers
  const headers = [
    'Name',
    'Role',
    'Company',
    'Domain',
    'Inferred Email',
    'Confirmed Email',
    'LinkedIn URL',
    'Tags',
    'Notes',
    'Source',
    'Date Added',
    'Last Updated'
  ];

  // CSV Rows
  const rows = contacts.map(contact => [
    escapeCsvValue(contact.name || ''),
    escapeCsvValue(contact.role || ''),
    escapeCsvValue(contact.company || ''),
    escapeCsvValue(contact.domain || ''),
    escapeCsvValue(contact.inferredEmail || ''),
    escapeCsvValue(contact.confirmedEmail || ''),
    escapeCsvValue(contact.linkedinUrl || ''),
    escapeCsvValue((contact.tags || []).join('; ')),
    escapeCsvValue(contact.notes || ''),
    escapeCsvValue(contact.source || 'extension'),
    escapeCsvValue(formatDate(contact.createdAt)),
    escapeCsvValue(formatDate(contact.updatedAt))
  ]);

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

/**
 * Export drafts to CSV format
 */
function exportDraftsToCSV(drafts, contacts) {
  if (!drafts || drafts.length === 0) {
    return 'No drafts to export';
  }

  const headers = [
    'Contact Name',
    'To Email',
    'Subject',
    'Body Preview',
    'Template ID',
    'Status',
    'Created At',
    'Sent At'
  ];

  const rows = drafts.map(draft => {
    const contact = contacts.find(c => c.id === draft.contactId);
    const bodyPreview = (draft.body || '').substring(0, 100).replace(/\n/g, ' ');

    return [
      escapeCsvValue(contact?.name || 'Unknown'),
      escapeCsvValue(draft.toEmail || ''),
      escapeCsvValue(draft.subject || ''),
      escapeCsvValue(bodyPreview),
      escapeCsvValue(draft.templateId || 'custom'),
      escapeCsvValue(draft.status || 'draft'),
      escapeCsvValue(formatDate(draft.createdAt)),
      escapeCsvValue(formatDate(draft.sentAt))
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

/**
 * Export outreach status to CSV
 */
function exportOutreachToCSV(outreach, contacts) {
  if (!outreach || outreach.length === 0) {
    return 'No outreach data to export';
  }

  const headers = [
    'Contact Name',
    'Company',
    'Email',
    'Status',
    'Last Updated',
    'Notes'
  ];

  const rows = outreach.map(status => {
    const contact = contacts.find(c => c.id === status.contactId);

    return [
      escapeCsvValue(contact?.name || 'Unknown'),
      escapeCsvValue(contact?.company || ''),
      escapeCsvValue(contact?.inferredEmail || contact?.confirmedEmail || ''),
      escapeCsvValue(status.status || 'drafted'),
      escapeCsvValue(formatDate(status.lastUpdatedAt)),
      escapeCsvValue(status.notes || '')
    ];
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

// ========================================
// JSON Export
// ========================================

/**
 * Export all data to JSON
 */
async function exportAllDataToJSON() {
  const data = await window.Storage.exportAllData();

  return JSON.stringify(data, null, 2);
}

/**
 * Export contacts only to JSON
 */
async function exportContactsToJSON() {
  const contacts = await window.Storage.getAllContacts();

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    type: 'contacts',
    count: contacts.length,
    data: contacts
  }, null, 2);
}

// ========================================
// Download Functions
// ========================================

/**
 * Download file to user's computer
 * @param {string} content - File content
 * @param {string} filename - Desired filename
 * @param {string} mimeType - MIME type (default: text/plain)
 */
function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  console.log('[Export] Downloaded:', filename);
}

/**
 * Download contacts as CSV
 */
async function downloadContactsCSV() {
  const contacts = await window.Storage.getAllContacts();
  const csv = exportContactsToCSV(contacts);
  const filename = `ellyn-contacts-${getDateString()}.csv`;

  downloadFile(csv, filename, 'text/csv');

  return { filename, count: contacts.length };
}

/**
 * Download drafts as CSV
 */
async function downloadDraftsCSV() {
  const drafts = await window.Storage.getAllDrafts();
  const contacts = await window.Storage.getAllContacts();
  const csv = exportDraftsToCSV(drafts, contacts);
  const filename = `ellyn-drafts-${getDateString()}.csv`;

  downloadFile(csv, filename, 'text/csv');

  return { filename, count: drafts.length };
}

/**
 * Download outreach status as CSV
 */
async function downloadOutreachCSV() {
  const outreach = await window.Storage.getAllContacts();
  const contacts = await window.Storage.getAllContacts();

  // Get outreach status for all contacts
  const outreachData = [];
  for (const contact of contacts) {
    const status = await window.Storage.getOutreachStatus(contact.id);
    if (status) {
      outreachData.push(status);
    }
  }

  const csv = exportOutreachToCSV(outreachData, contacts);
  const filename = `ellyn-outreach-${getDateString()}.csv`;

  downloadFile(csv, filename, 'text/csv');

  return { filename, count: outreachData.length };
}

/**
 * Download all data as JSON backup
 */
async function downloadBackupJSON() {
  const json = await exportAllDataToJSON();
  const filename = `ellyn-backup-${getDateString()}.json`;

  downloadFile(json, filename, 'application/json');

  return { filename };
}

// ========================================
// Import Functions
// ========================================

/**
 * Import data from JSON file
 * @param {File} file - JSON file from file input
 * @returns {Promise<Object>} Import result
 */
async function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);

        // Validate structure
        if (!json.version || !json.data) {
          throw new Error('Invalid backup file format');
        }

        // Import data
        await window.Storage.importAllData(json);

        resolve({
          success: true,
          version: json.version,
          importedAt: json.exportedAt,
          message: 'Data imported successfully'
        });

      } catch (error) {
        console.error('[Export] Import error:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Import contacts from CSV file
 */
async function importContactsFromCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        const contacts = parseContactsCSV(csv);

        let imported = 0;
        for (const contact of contacts) {
          try {
            await window.Storage.saveContact(contact);
            imported++;
          } catch (error) {
            console.error('[Export] Failed to import contact:', contact.name, error);
          }
        }

        resolve({
          success: true,
          total: contacts.length,
          imported: imported,
          message: `Imported ${imported} of ${contacts.length} contacts`
        });

      } catch (error) {
        console.error('[Export] CSV import error:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Parse CSV to contacts array
 */
function parseContactsCSV(csv) {
  const lines = csv.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const values = parseCSVLine(line);

    return {
      name: values[0] || '',
      role: values[1] || '',
      company: values[2] || '',
      domain: values[3] || '',
      inferredEmail: values[4] || '',
      confirmedEmail: values[5] || null,
      linkedinUrl: values[6] || '',
      tags: values[7] ? values[7].split(';').map(t => t.trim()).filter(t => t) : [],
      notes: values[8] || '',
      source: values[9] || 'import'
    };
  });
}

/**
 * Parse a single CSV line (handles quoted values)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current.trim());

  return values;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get date string for filenames (YYYY-MM-DD)
 */
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ========================================
// Exports
// ========================================

window.ExportUtil = {
  // CSV Export
  exportContactsToCSV,
  exportDraftsToCSV,
  exportOutreachToCSV,

  // JSON Export
  exportAllDataToJSON,
  exportContactsToJSON,

  // Download
  downloadFile,
  downloadContactsCSV,
  downloadDraftsCSV,
  downloadOutreachCSV,
  downloadBackupJSON,

  // Import
  importFromJSON,
  importContactsFromCSV
};

console.log('[Export] Module loaded');
