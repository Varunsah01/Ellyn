// Ellyn Sidepanel - Main Logic
// Handles LinkedIn extraction flow + manual input fallback

let currentContact = null;
let selectedEmail = null;
let extractedData = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Ellyn] Sidebar loaded');

  await loadRecentContacts();
  detectCurrentPage();
  setupEventListeners();
});

function setupEventListeners() {
  // Magic extract button
  document.getElementById('magic-extract-btn').addEventListener('click', magicExtract);

  // Manual form
  document.getElementById('contact-form').addEventListener('submit', handleManualSubmit);

  // Manual section toggle
  document.getElementById('manual-toggle').addEventListener('click', toggleManualSection);

  // Sync
  document.getElementById('sync-btn').addEventListener('click', handleSync);

  // Edit contact
  document.getElementById('edit-contact-btn').addEventListener('click', showEditForm);
  document.getElementById('edit-save-btn').addEventListener('click', saveEditedContact);
  document.getElementById('edit-cancel-btn').addEventListener('click', hideEditForm);

  // Save contact (extraction flow)
  document.getElementById('save-btn').addEventListener('click', handleSaveExtracted);

  // Open web app
  document.getElementById('open-web-app-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/contacts' });
  });

  // Copy draft
  const copyBtn = document.getElementById('copy-draft-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyDraft);
  }

  // Regenerate draft
  const regenBtn = document.getElementById('regenerate-btn');
  if (regenBtn) {
    regenBtn.addEventListener('click', regenerateDraft);
  }

  // Manual save/open
  const manualSaveBtn = document.getElementById('manual-save-btn');
  if (manualSaveBtn) {
    manualSaveBtn.addEventListener('click', handleSaveManual);
  }
  const manualWebBtn = document.getElementById('manual-open-web-btn');
  if (manualWebBtn) {
    manualWebBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000/contacts' });
    });
  }

  // Listen for tab changes from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'tabUpdated') {
      updateUIForUrl(message.url);
    }
  });
}

// ==========================================
// PAGE DETECTION
// ==========================================

function detectCurrentPage() {
  chrome.runtime.sendMessage({ action: 'getActiveTab' }, (response) => {
    if (chrome.runtime.lastError) {
      showNotLinkedInUI();
      return;
    }
    updateUIForUrl(response?.url || '');
  });
}

function updateUIForUrl(url) {
  if (url && url.includes('linkedin.com/in/')) {
    showLinkedInUI(url);
  } else {
    showNotLinkedInUI();
  }
}

function showLinkedInUI(url) {
  document.getElementById('linkedin-mode').style.display = 'block';
  document.getElementById('not-linkedin-prompt').style.display = 'none';

  // Extract name from URL as preview
  const slug = url.match(/linkedin\.com\/in\/([^/?]+)/);
  if (slug) {
    const name = slug[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    document.getElementById('detected-name').textContent = name;
  }

  // Collapse manual section when on LinkedIn
  const wrapper = document.getElementById('manual-form-wrapper');
  wrapper.style.display = 'none';
  document.getElementById('toggle-arrow').textContent = '\u25B6';
}

function showNotLinkedInUI() {
  document.getElementById('linkedin-mode').style.display = 'none';
  document.getElementById('not-linkedin-prompt').style.display = 'block';

  // Expand manual section when not on LinkedIn
  const wrapper = document.getElementById('manual-form-wrapper');
  wrapper.style.display = 'block';
  document.getElementById('toggle-arrow').textContent = '\u25BC';
}

function toggleManualSection() {
  const wrapper = document.getElementById('manual-form-wrapper');
  const arrow = document.getElementById('toggle-arrow');
  if (wrapper.style.display === 'none') {
    wrapper.style.display = 'block';
    arrow.textContent = '\u25BC';
  } else {
    wrapper.style.display = 'none';
    arrow.textContent = '\u25B6';
  }
}

// ==========================================
// MAGIC EXTRACT (LinkedIn one-click flow)
// ==========================================

async function magicExtract() {
  const btn = document.getElementById('magic-extract-btn');
  btn.disabled = true;

  showProgress('Extracting profile...');

  try {
    // Step 1: Extract profile data from LinkedIn
    const extractResult = await sendMessage({ action: 'extractProfile' });

    if (!extractResult || !extractResult.success) {
      throw new Error(extractResult?.error || 'Extraction failed');
    }

    extractedData = extractResult.data;

    // Step 2: Generate email patterns locally
    showProgress('Finding email patterns...');
    const emails = emailInference.generatePatterns({
      firstName: extractedData.firstName,
      lastName: extractedData.lastName,
      company: extractedData.company,
    });

    // Step 3: Try API enrichment for better results
    showProgress('Enriching contact data...');
    let enrichment = null;
    try {
      const apiResult = await apiClient.enrichContact({
        firstName: extractedData.firstName,
        lastName: extractedData.lastName,
        company: extractedData.company,
        role: extractedData.role,
      });
      if (apiResult.success) {
        enrichment = apiResult.enrichment;
        // Merge API emails with local patterns (API results take priority)
        if (apiResult.emails && apiResult.emails.length > 0) {
          emails.unshift(...apiResult.emails);
          // Deduplicate by email
          const seen = new Set();
          const unique = [];
          for (const e of emails) {
            if (!seen.has(e.email)) {
              seen.add(e.email);
              unique.push(e);
            }
          }
          emails.length = 0;
          emails.push(...unique.slice(0, 5));
        }
      }
    } catch {
      // API enrichment is optional - local patterns are enough
      console.log('[Ellyn] API enrichment unavailable, using local patterns');
    }

    // Step 4: Store contact
    currentContact = {
      firstName: extractedData.firstName,
      lastName: extractedData.lastName,
      company: extractedData.company,
      role: extractedData.role,
      headline: extractedData.headline,
      location: extractedData.location,
      profileUrl: extractedData.profileUrl,
      enrichment: enrichment || {},
      emails,
      source: 'linkedin',
    };

    // Step 5: Show results
    hideProgress();
    displayExtractionResults(currentContact);

  } catch (error) {
    console.error('[Ellyn] Magic extract error:', error);
    hideProgress();
    alert('Extraction failed: ' + error.message + '\n\nMake sure you are on a LinkedIn profile page.');
  } finally {
    btn.disabled = false;
  }
}

// ==========================================
// DISPLAY EXTRACTION RESULTS
// ==========================================

function displayExtractionResults(contact) {
  // Hide extraction UI, show results
  document.getElementById('linkedin-mode').style.display = 'none';
  document.getElementById('extract-results').style.display = 'block';

  // Fill contact card
  const initials = (contact.firstName[0] || '') + (contact.lastName[0] || '');
  document.getElementById('contact-avatar').textContent = initials.toUpperCase();
  document.getElementById('contact-name').textContent =
    `${contact.firstName} ${contact.lastName}`;
  document.getElementById('contact-role').textContent = contact.role || 'No role detected';
  document.getElementById('contact-company').textContent = contact.company || 'No company detected';

  // Fill email patterns
  const emailList = document.getElementById('email-list');
  emailList.innerHTML = '';

  if (!contact.emails || contact.emails.length === 0) {
    emailList.innerHTML = '<p style="color: #6b7280; font-size: 12px;">No email patterns generated. Try editing the company name.</p>';
    return;
  }

  contact.emails.forEach((pattern) => {
    const card = document.createElement('div');
    card.className = 'email-card';
    card.onclick = () => selectEmailExtracted(pattern.email);

    const confidenceClass = pattern.confidence >= 70 ? 'confidence-high' :
                            pattern.confidence >= 50 ? 'confidence-medium' :
                            'confidence-low';

    card.innerHTML = `
      <div class="email-address">${escapeHtml(pattern.email)}</div>
      <div class="email-meta">
        <span>${escapeHtml(pattern.pattern)}</span>
        <span class="confidence-badge ${confidenceClass}">${pattern.confidence}%</span>
      </div>
    `;

    emailList.appendChild(card);
  });

  // Auto-select the highest confidence pattern
  if (contact.emails.length > 0) {
    selectEmailExtracted(contact.emails[0].email);
  }
}

function selectEmailExtracted(email) {
  selectedEmail = email;

  document.querySelectorAll('#email-list .email-card').forEach(card => {
    card.classList.remove('selected');
    if (card.querySelector('.email-address').textContent === email) {
      card.classList.add('selected');
    }
  });

  // Try to generate AI draft
  generateDraft();
}

// ==========================================
// AI DRAFT GENERATION
// ==========================================

async function generateDraft() {
  if (!currentContact || !selectedEmail) return;

  const draftSection = document.getElementById('draft-section');
  const draftPreview = document.getElementById('draft-preview');

  draftSection.style.display = 'block';
  draftPreview.innerHTML = '<div class="draft-loading">Generating draft...</div>';

  try {
    const result = await apiClient.enrichContact({
      firstName: currentContact.firstName,
      lastName: currentContact.lastName,
      company: currentContact.company,
      role: currentContact.role,
      generateDraft: true,
      email: selectedEmail,
    });

    if (result.draft) {
      draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(result.draft)}</div>`;
    } else {
      // Generate a simple template locally
      const draft = generateLocalDraft(currentContact, selectedEmail);
      draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(draft)}</div>`;
    }
  } catch {
    // Fallback to local template
    const draft = generateLocalDraft(currentContact, selectedEmail);
    draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(draft)}</div>`;
  }
}

function generateLocalDraft(contact, email) {
  const firstName = contact.firstName || 'there';
  const role = contact.role ? ` as ${contact.role}` : '';
  const company = contact.company ? ` at ${contact.company}` : '';

  return `Hi ${firstName},

I came across your profile${role}${company} and was impressed by your work. I'd love to connect and explore potential synergies.

Would you be open to a brief chat this week?

Best regards`;
}

async function regenerateDraft() {
  await generateDraft();
}

function copyDraft() {
  const draftText = document.querySelector('#draft-preview .draft-text');
  if (draftText) {
    navigator.clipboard.writeText(draftText.textContent).then(() => {
      const btn = document.getElementById('copy-draft-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Draft'; }, 2000);
    });
  }
}

// ==========================================
// EDIT EXTRACTED CONTACT
// ==========================================

function showEditForm() {
  if (!currentContact) return;

  document.getElementById('edit-firstName').value = currentContact.firstName;
  document.getElementById('edit-lastName').value = currentContact.lastName;
  document.getElementById('edit-company').value = currentContact.company;
  document.getElementById('edit-role').value = currentContact.role;
  document.getElementById('edit-form').style.display = 'block';
}

function hideEditForm() {
  document.getElementById('edit-form').style.display = 'none';
}

function saveEditedContact() {
  if (!currentContact) return;

  currentContact.firstName = document.getElementById('edit-firstName').value;
  currentContact.lastName = document.getElementById('edit-lastName').value;
  currentContact.company = document.getElementById('edit-company').value;
  currentContact.role = document.getElementById('edit-role').value;

  // Regenerate email patterns with updated data
  const emails = emailInference.generatePatterns({
    firstName: currentContact.firstName,
    lastName: currentContact.lastName,
    company: currentContact.company,
  });
  currentContact.emails = emails;
  selectedEmail = null;

  hideEditForm();
  displayExtractionResults(currentContact);
}

// ==========================================
// SAVE EXTRACTED CONTACT
// ==========================================

async function handleSaveExtracted() {
  if (!selectedEmail || !currentContact) {
    alert('Please select an email pattern first');
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const selectedPattern = currentContact.emails.find(e => e.email === selectedEmail);

    const contactData = {
      firstName: currentContact.firstName,
      lastName: currentContact.lastName,
      company: currentContact.company,
      role: currentContact.role,
      inferredEmail: selectedEmail,
      emailConfidence: selectedPattern?.confidence,
      companyDomain: currentContact.enrichment?.domain || selectedPattern?.domain || '',
      companyIndustry: currentContact.enrichment?.industry || '',
      companySize: currentContact.enrichment?.size || '',
      linkedinUrl: currentContact.profileUrl || '',
      source: currentContact.source || 'extension',
    };

    const result = await apiClient.saveContact(contactData);

    if (result.success) {
      await storage.saveRecentContact({
        id: result.contact.id,
        name: `${currentContact.firstName} ${currentContact.lastName}`,
        company: currentContact.company,
        email: selectedEmail,
      });

      btn.textContent = 'Saved!';
      setTimeout(() => {
        btn.textContent = 'Save Contact';
        btn.disabled = false;
      }, 2000);

      await loadRecentContacts();
    } else {
      throw new Error(result.error || 'Save failed');
    }
  } catch (error) {
    console.error('[Ellyn] Save error:', error);
    alert('Failed to save: ' + error.message);
    btn.textContent = 'Save Contact';
    btn.disabled = false;
  }
}

// ==========================================
// MANUAL FLOW (unchanged from original)
// ==========================================

async function handleManualSubmit(e) {
  e.preventDefault();

  const formData = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    company: document.getElementById('company').value,
    role: document.getElementById('role').value || '',
  };

  showFormLoading(true);

  try {
    const result = await apiClient.enrichContact(formData);

    if (!result.success) {
      throw new Error(result.error || 'Enrichment failed');
    }

    currentContact = {
      ...formData,
      enrichment: result.enrichment,
      emails: result.emails,
      cost: result.cost,
      source: 'manual',
    };

    displayManualResults(result);
  } catch (error) {
    console.error('[Ellyn] Enrichment error:', error);

    // Fallback to local inference if API is down
    const emails = emailInference.generatePatterns(formData);
    if (emails.length > 0) {
      currentContact = {
        ...formData,
        enrichment: {},
        emails,
        source: 'manual',
      };
      displayManualResults({ enrichment: {}, emails });
    } else {
      alert('Failed to discover email: ' + error.message);
    }
  } finally {
    showFormLoading(false);
  }
}

function displayManualResults(result) {
  document.getElementById('results').style.display = 'block';

  document.getElementById('domain').textContent = result.enrichment?.domain || '-';
  document.getElementById('industry').textContent = result.enrichment?.industry || '-';
  document.getElementById('company-size').textContent = result.enrichment?.size || '-';

  const emailList = document.getElementById('manual-email-list');
  emailList.innerHTML = '';

  if (!result.emails || result.emails.length === 0) {
    emailList.innerHTML = '<p style="color: #6b7280; font-size: 12px;">No email patterns found</p>';
    return;
  }

  result.emails.forEach((pattern) => {
    const card = document.createElement('div');
    card.className = 'email-card';
    card.onclick = () => selectManualEmail(pattern.email);

    const confidenceClass = pattern.confidence >= 70 ? 'confidence-high' :
                            pattern.confidence >= 50 ? 'confidence-medium' :
                            'confidence-low';

    card.innerHTML = `
      <div class="email-address">${escapeHtml(pattern.email)}</div>
      <div class="email-meta">
        <span>${escapeHtml(pattern.pattern)}</span>
        <span class="confidence-badge ${confidenceClass}">${pattern.confidence}%</span>
      </div>
    `;

    emailList.appendChild(card);
  });
}

function selectManualEmail(email) {
  selectedEmail = email;

  document.querySelectorAll('#manual-email-list .email-card').forEach(card => {
    card.classList.remove('selected');
    if (card.querySelector('.email-address').textContent === email) {
      card.classList.add('selected');
    }
  });
}

async function handleSaveManual() {
  if (!selectedEmail || !currentContact) {
    alert('Please select an email pattern first');
    return;
  }

  try {
    const selectedPattern = currentContact.emails.find(e => e.email === selectedEmail);

    const contactData = {
      firstName: currentContact.firstName,
      lastName: currentContact.lastName,
      company: currentContact.company,
      role: currentContact.role,
      inferredEmail: selectedEmail,
      emailConfidence: selectedPattern?.confidence,
      companyDomain: currentContact.enrichment?.domain || '',
      companyIndustry: currentContact.enrichment?.industry || '',
      companySize: currentContact.enrichment?.size || '',
      source: 'extension',
    };

    const result = await apiClient.saveContact(contactData);

    if (result.success) {
      await storage.saveRecentContact({
        id: result.contact.id,
        name: `${currentContact.firstName} ${currentContact.lastName}`,
        company: currentContact.company,
        email: selectedEmail,
      });

      alert('Contact saved successfully!');
      await loadRecentContacts();

      document.getElementById('contact-form').reset();
      document.getElementById('results').style.display = 'none';
      selectedEmail = null;
      currentContact = null;
    } else {
      throw new Error(result.error || 'Save failed');
    }
  } catch (error) {
    console.error('[Ellyn] Save error:', error);
    alert('Failed to save contact: ' + error.message);
  }
}

// ==========================================
// SHARED UTILITIES
// ==========================================

function showProgress(text) {
  document.getElementById('extract-progress').style.display = 'block';
  document.getElementById('progress-text').textContent = text;
  document.getElementById('extract-results').style.display = 'none';
}

function hideProgress() {
  document.getElementById('extract-progress').style.display = 'none';
}

function showFormLoading(show) {
  const button = document.querySelector('#contact-form button[type="submit"]');
  if (show) {
    button.disabled = true;
    button.textContent = 'Enriching...';
  } else {
    button.disabled = false;
    button.textContent = 'Discover Email';
  }
}

async function loadRecentContacts() {
  const recentList = document.getElementById('recent-list');
  const contacts = await storage.getRecentContacts();

  if (contacts.length === 0) {
    recentList.innerHTML = '<p style="color: #9ca3af; font-size: 12px;">No recent contacts</p>';
    return;
  }

  recentList.innerHTML = contacts.map(contact => `
    <div class="recent-item">
      <div class="recent-name">${escapeHtml(contact.name)}</div>
      <div class="recent-company">${escapeHtml(contact.company || '')}</div>
    </div>
  `).join('');
}

async function handleSync() {
  try {
    const contacts = await apiClient.getRecentContacts(5);

    for (const contact of contacts) {
      await storage.saveRecentContact({
        id: contact.id,
        name: contact.full_name,
        company: contact.company,
        email: contact.inferred_email || contact.confirmed_email,
      });
    }

    await loadRecentContacts();
    alert('Synced with web app');
  } catch (error) {
    console.error('[Ellyn] Sync error:', error);
    alert('Sync failed: ' + error.message);
  }
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
