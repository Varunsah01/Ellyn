/**
 * Ellyn Sidebar - Main Logic
 *
 * Handles all sidebar interactions:
 * - Detecting LinkedIn profile pages
 * - Extracting profile data
 * - Generating email patterns
 * - Managing draft emails
 * - Saving contacts
 * - Loading recent contacts
 */

console.log('[Ellyn Sidebar] Initializing...');

// ========================================
// State Management
// ========================================
let currentContact = null;
let selectedEmail = null;
let emailPatterns = [];
let isLinkedInPage = false;

// Email templates
const EMAIL_TEMPLATES = {
  'cold-outreach': {
    subject: 'Quick question about {{company}}',
    body: `Hi {{firstName}},

I came across {{company}} and was impressed by your work.

I wanted to reach out because [YOUR REASON HERE].

Would you be open to a quick chat this week?

Best regards,
[YOUR NAME]`
  },
  'follow-up': {
    subject: 'Following up - {{company}}',
    body: `Hi {{firstName}},

I wanted to follow up on my previous email about [TOPIC].

I believe there could be value in connecting, especially regarding [SPECIFIC VALUE PROPOSITION].

Let me know if you'd like to schedule a brief call.

Thanks,
[YOUR NAME]`
  },
  'introduction': {
    subject: 'Introduction - [Your Name] + {{firstName}}',
    body: `Hi {{firstName}},

My name is [YOUR NAME] and I work on [YOUR WORK/COMPANY].

I noticed you're at {{company}} and thought we might have some interesting synergies around [TOPIC/AREA].

Would love to connect if you have 15 minutes in the coming weeks.

Best,
[YOUR NAME]`
  }
};

// ========================================
// DOM Elements
// ========================================
const elements = {
  contextIndicator: document.getElementById('context-indicator'),
  contextText: document.getElementById('context-text'),
  extractSection: document.getElementById('extract-section'),
  extractBtn: document.getElementById('extract-btn'),
  contactPreview: document.getElementById('contact-preview'),
  contactInitials: document.getElementById('contact-initials'),
  contactName: document.getElementById('contact-name'),
  contactRole: document.getElementById('contact-role'),
  contactCompany: document.getElementById('contact-company'),
  contactLinkedin: document.getElementById('contact-linkedin'),
  emailPatternsSection: document.getElementById('email-patterns-section'),
  emailPatternsList: document.getElementById('email-patterns-list'),
  draftSection: document.getElementById('draft-section'),
  templateSelect: document.getElementById('template-select'),
  emailSubject: document.getElementById('email-subject'),
  emailPreview: document.getElementById('email-preview'),
  actionsSection: document.getElementById('actions-section'),
  saveContactBtn: document.getElementById('save-contact-btn'),
  generateDraftBtn: document.getElementById('generate-draft-btn'),
  gmailBtn: document.getElementById('gmail-btn'),
  outlookBtn: document.getElementById('outlook-btn'),
  recentContactsList: document.getElementById('recent-contacts-list')
};

// ========================================
// Initialization
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Ellyn Sidebar] DOM loaded');

  // Check current tab
  await checkCurrentTab();

  // Load recent contacts
  await loadRecentContacts();

  // Setup event listeners
  setupEventListeners();

  // Initialize AI generation
  if (window.AIGeneration) {
    await window.AIGeneration.initialize();
  }

  console.log('[Ellyn Sidebar] Initialization complete');
});

// ========================================
// Tab Detection
// ========================================
/**
 * Check if current active tab is a LinkedIn profile page
 */
async function checkCurrentTab() {
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      updateContextIndicator(false, 'No active tab found');
      return;
    }

    // Check if it's a LinkedIn URL
    const isLinkedIn = tab.url && tab.url.includes('linkedin.com/in/');

    if (isLinkedIn) {
      // Ask content script if it's a profile page
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'checkPage' });

        if (response && response.isProfilePage) {
          updateContextIndicator(true, 'LinkedIn profile detected');
          isLinkedInPage = true;
        } else {
          updateContextIndicator(false, 'Open a LinkedIn profile to get started');
          isLinkedInPage = false;
        }
      } catch (error) {
        console.error('[Ellyn Sidebar] Error checking page:', error);
        updateContextIndicator(false, 'Open a LinkedIn profile to get started');
        isLinkedInPage = false;
      }
    } else {
      updateContextIndicator(false, 'Open a LinkedIn profile to get started');
      isLinkedInPage = false;
    }

  } catch (error) {
    console.error('[Ellyn Sidebar] Error checking tab:', error);
    updateContextIndicator(false, 'Error checking current tab');
    isLinkedInPage = false;
  }
}

/**
 * Update the context indicator UI
 */
function updateContextIndicator(success, message) {
  elements.contextIndicator.className = success ? 'context-indicator success' : 'context-indicator';
  elements.contextText.textContent = message;

  // Show/hide extract section based on context
  if (success) {
    elements.extractSection.classList.remove('hidden');
  } else {
    elements.extractSection.classList.add('hidden');
    // Hide other sections too
    elements.contactPreview.classList.add('hidden');
    elements.emailPatternsSection.classList.add('hidden');
    elements.draftSection.classList.add('hidden');
    elements.actionsSection.classList.add('hidden');
  }
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
  // Extract button
  elements.extractBtn.addEventListener('click', handleExtract);

  // Template selector
  elements.templateSelect.addEventListener('change', handleTemplateChange);

  // Action buttons
  elements.saveContactBtn.addEventListener('click', handleSaveContact);
  elements.generateDraftBtn.addEventListener('click', handleGenerateDraft);
  elements.gmailBtn.addEventListener('click', () => handleOpenMailClient('gmail'));
  elements.outlookBtn.addEventListener('click', () => handleOpenMailClient('outlook'));

  // Listen for URL changes from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'urlChanged') {
      checkCurrentTab();
    }
  });
}

// ========================================
// Profile Extraction
// ========================================
/**
 * Handle extract button click
 */
async function handleExtract() {
  console.log('[Ellyn Sidebar] Starting extraction...');

  // Disable button and show loading state
  elements.extractBtn.disabled = true;
  elements.extractBtn.textContent = 'Extracting...';

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    // Send extraction request to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });

    if (response && response.success) {
      console.log('[Ellyn Sidebar] Extraction successful:', response.data);

      // Store contact data
      currentContact = response.data;

      // Display contact
      displayContact(response.data);

      // Generate email patterns
      generateEmailPatterns(response.data);

      // Show sections
      elements.contactPreview.classList.remove('hidden');
      elements.emailPatternsSection.classList.remove('hidden');

      // Show AI draft section (instead of old draft section)
      const aiDraftSection = document.getElementById('ai-draft-section');
      if (aiDraftSection) {
        aiDraftSection.classList.remove('hidden');
      }

      elements.actionsSection.classList.remove('hidden');

      // Enable action buttons
      updateActionButtons(true);

    } else {
      throw new Error(response?.error || 'Extraction failed');
    }

  } catch (error) {
    console.error('[Ellyn Sidebar] Extraction error:', error);
    alert('Failed to extract profile data. Please make sure you are on a LinkedIn profile page.');
  } finally {
    // Reset button
    elements.extractBtn.disabled = false;
    elements.extractBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Extract Contact Data
    `;
  }
}

/**
 * Display contact information in preview card
 */
function displayContact(contact) {
  // Set initials
  const initials = window.EmailPatterns.getInitials(contact.fullName);
  elements.contactInitials.textContent = initials;

  // Set contact details
  elements.contactName.textContent = contact.fullName;
  elements.contactRole.textContent = contact.currentRole;
  elements.contactCompany.textContent = contact.companyName;

  // Set LinkedIn URL
  elements.contactLinkedin.href = contact.linkedinUrl;
  elements.contactLinkedin.classList.remove('hidden');
}

/**
 * Generate email patterns from contact data
 * Uses the new email-inference engine with caching
 */
async function generateEmailPatterns(contact) {
  console.log('[Ellyn Sidebar] Generating email patterns with inference engine...');

  try {
    // Get inference cache
    const cache = await window.Storage.getInferenceCache();
    console.log('[Ellyn Sidebar] Loaded inference cache:', cache);

    // Infer domain from company name
    const domain = window.EmailInference.inferCompanyDomain(contact.companyName, cache);
    console.log('[Ellyn Sidebar] Inferred domain:', domain);

    // Generate patterns with advanced heuristics
    const options = {
      role: contact.currentRole,
      companySize: window.EmailInference.estimateCompanySize(domain),
      cache: cache
    };

    emailPatterns = window.EmailInference.generateEmailPatterns(
      contact.firstName,
      contact.lastName,
      domain,
      options
    );

    console.log('[Ellyn Sidebar] Generated patterns with confidence scores:', emailPatterns);

    // Display patterns
    displayEmailPatterns(emailPatterns);

  } catch (error) {
    console.error('[Ellyn Sidebar] Error generating email patterns:', error);
    // Fallback to basic pattern generation
    const domain = window.EmailPatterns.guessDomain(contact.companyName);
    emailPatterns = window.EmailPatterns.generateEmailPatterns(
      contact.firstName,
      contact.lastName,
      domain
    );
    displayEmailPatterns(emailPatterns);
  }
}

/**
 * Display email patterns in the UI
 * Now displays confidence as percentage (0-100) with proper color coding
 */
function displayEmailPatterns(patterns) {
  elements.emailPatternsList.innerHTML = '';

  patterns.forEach((pattern, index) => {
    const item = document.createElement('div');
    item.className = 'email-pattern-item';
    item.dataset.email = pattern.email;
    item.dataset.pattern = pattern.pattern;

    // Convert confidence (0-1) to percentage (0-100)
    const confidencePercent = Math.round(pattern.confidence * 100);

    // Get confidence level for styling
    let confidenceLevel;
    if (confidencePercent >= 70) {
      confidenceLevel = 'high';
    } else if (confidencePercent >= 50) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    item.innerHTML = `
      <div class="email-pattern-info">
        <div class="email-pattern-email">${pattern.email}</div>
        <div class="email-pattern-type">${pattern.pattern}</div>
      </div>
      <div class="email-pattern-confidence">
        <span class="confidence-badge confidence-${confidenceLevel}">
          ${confidencePercent}%
        </span>
      </div>
    `;

    // Click to select
    item.addEventListener('click', () => {
      // Remove previous selection
      document.querySelectorAll('.email-pattern-item').forEach(el => {
        el.classList.remove('selected');
      });

      // Add selection
      item.classList.add('selected');
      selectedEmail = pattern.email;

      // Enable action buttons
      updateActionButtons(true);
    });

    elements.emailPatternsList.appendChild(item);

    // Auto-select first pattern (highest confidence)
    if (index === 0) {
      item.click();
    }
  });
}

// ========================================
// Email Draft
// ========================================
/**
 * Handle template selection change
 */
function handleTemplateChange() {
  const templateId = elements.templateSelect.value;
  updateDraftPreview(templateId);
}

/**
 * Update draft email preview
 */
function updateDraftPreview(templateId) {
  if (!currentContact || !templateId) return;

  const template = EMAIL_TEMPLATES[templateId];
  if (!template) return;

  // Replace placeholders
  const variables = {
    firstName: currentContact.firstName,
    lastName: currentContact.lastName,
    fullName: currentContact.fullName,
    company: currentContact.companyName
  };

  const subject = replaceVariables(template.subject, variables);
  const body = replaceVariables(template.body, variables);

  // Update UI
  elements.emailSubject.value = subject;
  elements.emailPreview.textContent = body;
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(text, variables) {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

// ========================================
// Actions
// ========================================
/**
 * Handle save contact button
 */
async function handleSaveContact() {
  if (!currentContact || !selectedEmail) {
    alert('Please extract a profile and select an email first');
    return;
  }

  try {
    // Save to storage
    await window.Storage.saveContact({
      name: currentContact.fullName,
      role: currentContact.currentRole,
      company: currentContact.companyName,
      linkedinUrl: currentContact.linkedinUrl,
      selectedEmail: selectedEmail,
      emailPatterns: emailPatterns
    });

    // Refresh recent contacts
    await loadRecentContacts();

    // Open web app with pre-filled data
    const webAppUrl = `http://localhost:3001/?prefill=true&name=${encodeURIComponent(currentContact.fullName)}&company=${encodeURIComponent(currentContact.companyName)}`;

    chrome.tabs.create({ url: webAppUrl });

    // Show success message
    alert('Contact saved! Opening web app...');

  } catch (error) {
    console.error('[Ellyn Sidebar] Error saving contact:', error);
    alert('Failed to save contact');
  }
}

/**
 * Handle generate draft button
 */
function handleGenerateDraft() {
  if (!selectedEmail) {
    alert('Please select an email first');
    return;
  }

  // Update draft preview with current template
  const templateId = elements.templateSelect.value;
  updateDraftPreview(templateId);

  alert('Draft generated! You can now open it in Gmail or Outlook.');
}

/**
 * Handle open mail client buttons
 */
async function handleOpenMailClient(client) {
  if (!selectedEmail) {
    alert('Please select an email first');
    return;
  }

  const subject = elements.emailSubject.value || 'Hello';
  const body = elements.emailPreview.textContent || '';

  // Open based on client
  if (client === 'gmail') {
    // Gmail compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${selectedEmail}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    chrome.tabs.create({ url: gmailUrl });
  } else if (client === 'outlook') {
    // Outlook compose URL
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${selectedEmail}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    chrome.tabs.create({ url: outlookUrl });
  }

  // Cache the selected email pattern for learning
  await cacheSelectedPattern();
}

/**
 * Cache the selected email pattern for future learning
 * This improves accuracy over time as the extension learns which patterns work
 */
async function cacheSelectedPattern() {
  if (!currentContact || !selectedEmail) {
    return;
  }

  try {
    // Extract domain from selected email
    const domain = selectedEmail.split('@')[1];

    // Find the pattern type that was selected
    const selectedPattern = emailPatterns.find(p => p.email === selectedEmail);
    if (!selectedPattern) {
      console.warn('[Ellyn Sidebar] Selected pattern not found in patterns list');
      return;
    }

    // Cache the domain mapping (company → domain)
    await window.Storage.cacheDomainMapping(currentContact.companyName, domain);

    // Cache the email pattern (domain → pattern type)
    await window.Storage.cacheEmailPattern(domain, selectedPattern.pattern);

    console.log('[Ellyn Sidebar] ✓ Cached pattern for learning:', {
      company: currentContact.companyName,
      domain: domain,
      pattern: selectedPattern.pattern
    });

  } catch (error) {
    console.error('[Ellyn Sidebar] Error caching pattern:', error);
    // Don't block the user flow if caching fails
  }
}

/**
 * Update action button states
 */
function updateActionButtons(enabled) {
  elements.saveContactBtn.disabled = !enabled;
  elements.generateDraftBtn.disabled = !enabled;
  elements.gmailBtn.disabled = !enabled || !selectedEmail;
  elements.outlookBtn.disabled = !enabled || !selectedEmail;
}

// ========================================
// Recent Contacts
// ========================================
/**
 * Load and display recent contacts
 */
async function loadRecentContacts() {
  try {
    const contacts = await window.Storage.getRecentContacts(5);

    if (contacts.length === 0) {
      elements.recentContactsList.innerHTML = '<p class="empty-state">No recent contacts</p>';
      return;
    }

    elements.recentContactsList.innerHTML = '';

    contacts.forEach(contact => {
      const item = document.createElement('div');
      item.className = 'recent-contact-item';

      const initials = window.EmailPatterns.getInitials(contact.name);

      item.innerHTML = `
        <div class="recent-contact-avatar">${initials}</div>
        <div class="recent-contact-info">
          <div class="recent-contact-name">${contact.name}</div>
          <div class="recent-contact-company">${contact.company}</div>
        </div>
      `;

      // Click to view in web app
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:3001/dashboard' });
      });

      elements.recentContactsList.appendChild(item);
    });

  } catch (error) {
    console.error('[Ellyn Sidebar] Error loading recent contacts:', error);
  }
}

// Initialize template preview when sidebar loads
document.addEventListener('DOMContentLoaded', () => {
  // Set default template
  if (elements.templateSelect) {
    elements.templateSelect.value = 'cold-outreach';
  }
});

console.log('[Ellyn Sidebar] Script loaded successfully');

// TODO: Future enhancements
// - Add copy-to-clipboard for emails
// - Add email validation/verification status indicators
// - Add more email templates
// - Add template customization
// - Add bulk contact import
// - Add keyboard shortcuts
// - Add dark mode support
// - Add analytics/tracking
