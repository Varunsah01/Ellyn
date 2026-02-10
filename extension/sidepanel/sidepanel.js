// Ellyn Sidepanel - Main Logic
// Handles LinkedIn extraction flow + manual input fallback

let currentContact = null;
let selectedEmail = null;
let extractedData = null;
let selectedTemplate = null;
let userProfile = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Ellyn] Sidebar loaded');

  await loadRecentContacts();
  await loadUserProfile();
  await loadContactQueue();
  detectCurrentPage();
  setupEventListeners();
  setupMagicWorkflow();
  setupQueueListeners();
  registerDefaultShortcuts();
  setupNavigationTabs();

  // Onboarding
  await initializeOnboarding();
});

function setupEventListeners() {
  // Magic extract button - now runs full workflow
  document.getElementById('magic-extract-btn').addEventListener('click', runMagicWorkflow);

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
  const eligibility = window.EllynPageDetector.detectEligibility(url);
  
  if (eligibility.eligible) {
    showLinkedInUI(url);
    // Track LinkedIn visit
    trackOnboardingProgress('linkedin-visit');
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
  console.warn('[Ellyn] Legacy magicExtract is disabled.');
  showToast('Legacy extraction disabled. Please use the new workflow.');
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

  // Show and render template selector
  renderTemplateSelector(contact);

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
// TEMPLATE SELECTOR
// ==========================================

function renderTemplateSelector(contact) {
  const section = document.getElementById('template-selector-section');
  const optionsContainer = document.getElementById('template-options');

  section.style.display = 'block';
  optionsContainer.innerHTML = '';

  // Get template types
  const templates = recruiterTemplates.getTemplateTypes();

  // Get recommendation
  const recommended = recruiterTemplates.getRecommendation(contact);

  // Render template options
  templates.forEach(template => {
    const option = document.createElement('button');
    option.className = 'template-option';
    option.dataset.template = template.id;

    if (template.id === recommended) {
      option.classList.add('recommended');
    }

    option.innerHTML = `
      <div class="template-icon">${template.icon}</div>
      <div class="template-name">${template.name}</div>
      <div class="template-desc">${template.description}</div>
    `;

    option.addEventListener('click', () => selectTemplate(template.id));

    optionsContainer.appendChild(option);
  });

  // Auto-select recommended template
  selectTemplate(recommended);
}

function selectTemplate(templateId) {
  selectedTemplate = templateId;

  // Update UI
  document.querySelectorAll('.template-option').forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.template === templateId) {
      option.classList.add('selected');
    }
  });

  // Regenerate draft with new template
  if (selectedEmail) {
    generateDraft();
  }
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
    // Use template-based draft if template is selected
    if (selectedTemplate && selectedTemplate !== 'ai') {
      const draft = generateTemplateDraft(currentContact, selectedTemplate);
      draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(draft)}</div>`;
      return;
    }

    // Try API-based AI generation for 'ai' template
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
      // Fallback to template
      const draft = generateTemplateDraft(currentContact, selectedTemplate || 'advice');
      draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(draft)}</div>`;
    }
  } catch {
    // Fallback to template-based draft
    const draft = generateTemplateDraft(currentContact, selectedTemplate || 'advice');
    draftPreview.innerHTML = `<div class="draft-text">${escapeHtml(draft)}</div>`;
  }
}

function generateTemplateDraft(contact, templateType) {
  // Generate template with user profile
  const template = recruiterTemplates.generateTemplate(
    templateType,
    contact,
    userProfile
  );

  // Enhance with company context
  let draft = `Subject: ${template.subject}\n\n${template.body}`;
  draft = recruiterTemplates.enhanceWithCompanyContext(draft, contact.company);

  return draft;
}

function generateLocalDraft(contact, email) {
  // Legacy fallback - use advice template
  return generateTemplateDraft(contact, 'advice');
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
    showToast('Please select an email pattern first');
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
    showToast('Failed to save: ' + error.message);
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
      showToast('Failed to discover email: ' + error.message);
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
    showToast(UIMessages.sync.success);
  } catch (error) {
    console.error('[Ellyn] Sync error:', error);
    showToast(UIMessages.sync.error + error.message);
  }
}

async function loadUserProfile() {
  try {
    const profile = await storage.getUserProfile();
    if (profile) {
      userProfile = profile;
      recruiterTemplates.setUserProfile(profile);
    } else {
      // Set default profile
      userProfile = recruiterTemplates.getUserProfile();
    }
  } catch (error) {
    console.error('[Ellyn] Load profile error:', error);
    userProfile = recruiterTemplates.getUserProfile();
  }
}

// ==========================================
// CONTACT QUEUE MANAGEMENT
// ==========================================

async function loadContactQueue() {
  try {
    const queue = await contactQueue.getQueue();
    const stats = await contactQueue.getQueueStats();

    updateQueueUI(queue, stats);
  } catch (error) {
    console.error('[Queue] Load error:', error);
  }
}

function updateQueueUI(queue, stats) {
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const queueFooter = document.getElementById('queue-footer');
  const pendingCount = document.getElementById('pending-count');

  // Update count
  if (queueCount) {
    queueCount.textContent = `${queue.length} contact${queue.length !== 1 ? 's' : ''}`;
  }

  // Update pending count
  if (pendingCount) {
    pendingCount.textContent = stats.pending;
  }

  // Show/hide footer
  if (queueFooter) {
    queueFooter.style.display = stats.pending > 0 ? 'block' : 'none';
  }

  // Render queue items
  if (queueList) {
    if (queue.length === 0) {
      queueList.innerHTML = `
        <div class="empty-queue">
          <p>No contacts in queue</p>
          <p class="queue-hint">Extract LinkedIn profiles and add them to queue for batch processing</p>
        </div>
      `;
    } else {
      queueList.innerHTML = queue.map(contact => renderQueueItem(contact)).join('');
    }
  }
}

function renderQueueItem(contact) {
  const initials = (contact.firstName?.[0] || '') + (contact.lastName?.[0] || '');
  const statusClass = contact.status || 'pending';
  const statusLabel = {
    pending: 'Pending',
    generating: 'Generating...',
    ready: 'Ready',
    sent: 'Sent',
    error: 'Error'
  }[contact.status] || 'Unknown';

  return `
    <div class="queue-item" data-contact-id="${contact.id}">
      <div class="contact-avatar">${escapeHtml(initials.toUpperCase())}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}</div>
        <div class="contact-role">${escapeHtml(contact.role || 'No role')}</div>
        <div class="contact-company">${escapeHtml(contact.company || 'No company')}</div>
      </div>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
      <div class="queue-actions">
        ${contact.status === 'pending' ? `
          <button class="icon-btn" title="Generate draft" onclick="generateSingleDraft('${contact.id}')">✨</button>
        ` : ''}
        ${contact.status === 'ready' ? `
          <button class="icon-btn" title="View draft" onclick="viewQueueDraft('${contact.id}')">👁️</button>
        ` : ''}
        <button class="icon-btn" title="Remove" onclick="removeFromQueue('${contact.id}')">×</button>
      </div>
    </div>
  `;
}

function setupQueueListeners() {
  // Clear queue button
  const clearBtn = document.getElementById('clear-queue-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearContactQueue);
  }

  // View drafts button
  const viewDraftsBtn = document.getElementById('view-drafts-btn');
  if (viewDraftsBtn) {
    viewDraftsBtn.addEventListener('click', openDraftsView);
  }

  // Batch generate button
  const batchBtn = document.getElementById('batch-generate-btn');
  if (batchBtn) {
    batchBtn.addEventListener('click', batchGenerateDrafts);
  }
}

async function addContactToQueue(contact) {
  try {
    // Make sure contact has email selected
    if (!contact.selectedEmail && contact.emails && contact.emails.length > 0) {
      contact.selectedEmail = contact.emails[0].email;
    }

    await contactQueue.addToQueue(contact);
    await loadContactQueue();

    showToast(`${contact.firstName} ${contact.lastName} added to queue`);
  } catch (error) {
    console.error('[Queue] Add error:', error);
    showToast(error.message);
  }
}

async function removeFromQueue(contactId) {
  const confirmed = confirm('Remove this contact from queue?');
  if (!confirmed) return;

  try {
    await contactQueue.removeFromQueue(contactId);
    await loadContactQueue();
    showToast('Contact removed from queue');
  } catch (error) {
    console.error('[Queue] Remove error:', error);
    showToast('Failed to remove contact');
  }
}

async function clearContactQueue() {
  const queue = await contactQueue.getQueue();
  if (queue.length === 0) return;

  const confirmed = confirm(`Clear all ${queue.length} contacts from queue?`);
  if (!confirmed) return;

  try {
    await contactQueue.clearQueue();
    await loadContactQueue();
    showToast('Queue cleared');
  } catch (error) {
    console.error('[Queue] Clear error:', error);
    showToast('Failed to clear queue');
  }
}

async function generateSingleDraft(contactId) {
  try {
    const queue = await contactQueue.getQueue();
    const contact = queue.find(c => c.id === contactId);

    if (!contact) {
      showToast(UIMessages.queue.notFound);
      return;
    }

    // Update status to generating
    await contactQueue.updateContactStatus(contactId, 'generating');
    await loadContactQueue();

    // Generate draft
    const draft = await contactQueue.generateDraftForContact(contact);

    // Update with draft
    await contactQueue.updateContactStatus(contactId, 'ready', { draft });
    await loadContactQueue();

    showToast(UIMessages.queue.generationSuccess.replace('Drafts', 'Draft'));
  } catch (error) {
    console.error('[Queue] Generate error:', error);
    await contactQueue.updateContactStatus(contactId, 'error', { error: error.message });
    await loadContactQueue();
    showToast(UIMessages.queue.generationError + error.message);
  }
}

async function viewQueueDraft(contactId) {
  const queue = await contactQueue.getQueue();
  const contact = queue.find(c => c.id === contactId);

  if (!contact || !contact.draft) {
    showToast(UIMessages.queue.notFound);
    return;
  }

  // Quick preview modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="view-subject"><strong>Subject:</strong> ${escapeHtml(contact.draft.subject)}</div>
        <div class="view-body">${escapeHtml(contact.draft.body).replace(/\n/g, '<br>')}</div>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn modal-close">Close</button>
        <button class="primary-btn" id="send-from-queue">Send via Gmail</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', () => modal.remove());
  });

  // Send handler
  const sendBtn = modal.querySelector('#send-from-queue');
  sendBtn.addEventListener('click', () => {
    sendQueueContactViaGmail(contact);
    modal.remove();
  });
}

function sendQueueContactViaGmail(contact) {
  const subject = contact.draft?.subject || '';
  const body = contact.draft?.body || '';
  const email = contact.selectedEmail || contact.emails?.[0]?.email || '';

  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const encodedEmail = encodeURIComponent(email);

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;

  chrome.tabs.create({ url: gmailUrl });

  contactQueue.markAsSent(contact.id).then(() => {
    loadContactQueue();
    showToast(`Email draft opened for ${contact.firstName}`);
  });
}

async function batchGenerateDrafts() {
  const stats = await contactQueue.getQueueStats();

  if (stats.pending === 0) {
    showToast(UIMessages.queue.empty);
    return;
  }

  const confirmed = confirm(
    `Generate drafts for ${stats.pending} contact${stats.pending !== 1 ? 's' : ''}?\n\nThis will take approximately ${Math.ceil(stats.pending * 2)} seconds.`
  );

  if (!confirmed) return;

  // Show progress modal
  const modal = document.getElementById('batch-progress-modal');
  modal.style.display = 'flex';

  try {
    const results = await contactQueue.batchGenerateDrafts((current, total, contact) => {
      const percent = (current / total) * 100;
      document.getElementById('batch-progress-bar').style.width = percent + '%';
      document.getElementById('batch-progress-text').textContent =
        `Generating draft for ${contact.firstName} ${contact.lastName}...`;
      document.getElementById('batch-progress-count').textContent = `${current} / ${total}`;
    });

    // Hide modal
    modal.style.display = 'none';

    // Show results
    showToast(UIMessages.queue.generationSuccess + ` (${results.success} sent, ${results.failed} failed)`);

    // Reload queue
    await loadContactQueue();

    // Ask if user wants to view drafts
    if (results.success > 0) {
      const viewDrafts = confirm(`${results.success} draft${results.success !== 1 ? 's' : ''} ready! View them now?`);
      if (viewDrafts) {
        openDraftsView();
      }
    }

  } catch (error) {
    console.error('[Queue] Batch generate error:', error);
    modal.style.display = 'none';
    showToast(UIMessages.queue.generationError + error.message);
  }
}

function openDraftsView() {
  document.getElementById('queue-view-container').style.display = 'none';
  document.getElementById('drafts-view-container').style.display = 'block';
  draftsView.render();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// MAGIC WORKFLOW (3-CLICK FLOW)
// ==========================================

function setupMagicWorkflow() {
  // Quick edit button
  const quickEditBtn = document.getElementById('magic-quick-edit');
  if (quickEditBtn) {
    quickEditBtn.addEventListener('click', toggleQuickEdit);
  }

  // Undo button
  const undoBtn = document.getElementById('magic-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', handleUndo);
  }

  // Redo button
  const redoBtn = document.getElementById('magic-redo');
  if (redoBtn) {
    redoBtn.addEventListener('click', handleRedo);
  }

  // Send via Gmail
  const sendGmailBtn = document.getElementById('magic-send-gmail');
  if (sendGmailBtn) {
    sendGmailBtn.addEventListener('click', sendViaGmail);
  }

  // Send via Outlook
  const sendOutlookBtn = document.getElementById('magic-send-outlook');
  if (sendOutlookBtn) {
    sendOutlookBtn.addEventListener('click', sendViaOutlook);
  }

  // Copy draft
  const copyDraftBtn = document.getElementById('magic-copy-draft');
  if (copyDraftBtn) {
    copyDraftBtn.addEventListener('click', copyMagicDraft);
  }

  // Draft input listeners for live updates
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');

  if (subjectInput) {
    subjectInput.addEventListener('input', updateDraftFromInputs);
  }

  if (bodyInput) {
    bodyInput.addEventListener('input', updateDraftFromInputs);
  }
}

async function runMagicWorkflow() {
  const btn = document.getElementById('magic-extract-btn');
  const originalHTML = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = `
    <span class="magic-btn-icon">⏳</span>
    <span class="magic-btn-content">
      <span class="magic-btn-title">Working Magic...</span>
      <span class="magic-btn-subtitle">Orchestrating workflow...</span>
    </span>
  `;

  document.getElementById('linkedin-mode').style.display = 'none';
  document.getElementById('magic-progress-container').style.display = 'block';

  try {
    // 1. Run Workflow Orchestrator
    const result = await sendMessage({ action: 'runOrchestrator' });

    if (!result || result.status === 'blocked') {
      throw new Error(result?.error || 'Workflow blocked by orchestrator');
    }

    // 2. Map Data
    const data = result.data || {};
    const fullName = data.name?.value || '';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contact = {
      firstName,
      lastName,
      company: data.company?.value || '',
      role: data.role?.value || '',
      headline: '', // Future: Extract via Orchestrator
      location: '', // Future: Extract via Orchestrator
      profileUrl: '', // Future: Pass from content script
      source: 'linkedin',
      orchestratorStatus: result.status
    };

    // 3. Email Inference & Enrichment
    // Generate local patterns
    let emails = emailInference.generatePatterns(contact);

    // Try API Enrichment
    try {
      const apiResult = await apiClient.enrichContact(contact);
      if (apiResult.success) {
        contact.enrichment = apiResult.enrichment;
        if (apiResult.emails && apiResult.emails.length > 0) {
          emails.unshift(...apiResult.emails);
          // Deduplicate
          const seen = new Set();
          const unique = [];
          for (const e of emails) {
            if (!seen.has(e.email)) {
              seen.add(e.email);
              unique.push(e);
            }
          }
          emails = unique.slice(0, 5);
        }
      }
    } catch (e) {
      console.log('[Ellyn] API enrichment skipped:', e);
    }
    contact.emails = emails;

    // 4. Role Detection
    if (window.roleDetector) {
      const roleData = roleDetector.detectRecruiterRole(contact.role, contact.company);
      contact.isRecruiter = roleData.isRecruiter;
      selectedTemplate = roleData.recommendedTemplate;
    }

    // 5. Update State & UI
    currentContact = contact;
    
    // Hide progress
    document.getElementById('magic-progress-container').style.display = 'none';
    
    // Display results
    displayExtractionResults(contact);

    // Handle Partial Status (Recovery Flow)
    if (result.status === 'partial') {
      showToast('⚠️ Some details need verification');
      // Highlight low confidence fields if possible
      // For now, just show the edit form to encourage review
      showEditForm();
    } else {
      // Success path - Auto-generate draft
      if (contact.emails.length > 0) {
        selectedEmail = contact.emails[0].email; // Auto-select top email
        generateDraft(); // Generate draft immediately
      }
    }

  } catch (error) {
    console.error('[Magic] Workflow error:', error);
    showToast('Workflow failed: ' + error.message);
    
    // Reset UI
    document.getElementById('magic-progress-container').style.display = 'none';
    document.getElementById('linkedin-mode').style.display = 'block';
  } finally {
    // Restore button
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

function displayMagicResults(result) {
  // Show quick action modal first
  showExtractSuccessModal(result);
}

function showExtractSuccessModal(result) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'extract-success-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>✓ Contact Extracted & Draft Ready!</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="contact-card">
          <div class="contact-avatar">${getContactInitials(result.contact)}</div>
          <div class="contact-details">
            <div class="contact-name">${escapeHtml(result.contact.firstName)} ${escapeHtml(result.contact.lastName)}</div>
            <div class="contact-role">${escapeHtml(result.contact.role || 'No role')}</div>
            <div class="contact-company">${escapeHtml(result.contact.company || 'No company')}</div>
          </div>
        </div>

        <div class="draft-summary">
          <div class="draft-subject"><strong>Subject:</strong> ${escapeHtml(result.draft.subject)}</div>
          <div class="draft-snippet">${escapeHtml(result.draft.body.substring(0, 150))}...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" id="add-to-queue-btn">
          ➕ Add to Queue
        </button>
        <button class="primary-btn" id="view-draft-btn">
          👁️ View & Send Now
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', () => {
      modal.remove();
      resetToLinkedInMode();
    });
  });

  // Add to queue
  modal.querySelector('#add-to-queue-btn').addEventListener('click', async () => {
    modal.remove();

    // Add to queue with draft already generated
    const contact = result.contact;
    contact.status = 'ready';
    contact.draft = result.draft;
    contact.selectedEmail = result.email;

    await addContactToQueue(contact);
    resetToLinkedInMode();
  });

  // View draft
  modal.querySelector('#view-draft-btn').addEventListener('click', () => {
    modal.remove();
    showFullDraftView(result);
  });
}

function showFullDraftView(result) {
  // Hide progress, show results with fade-in effect
  const progressContainer = document.getElementById('magic-progress-container');
  const resultsContainer = document.getElementById('magic-results-container');

  progressContainer.style.display = 'none';
  resultsContainer.style.display = 'block';

  // Fill draft fields
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');
  const wordCount = document.getElementById('magic-word-count');
  const charCount = document.getElementById('magic-char-count');
  const draftSource = document.getElementById('magic-draft-source');

  if (subjectInput) {
    subjectInput.value = result.draft.subject;
    subjectInput.setAttribute('readonly', 'readonly');
  }

  if (bodyInput) {
    bodyInput.value = result.draft.body;
    bodyInput.setAttribute('readonly', 'readonly');
  }

  if (wordCount) {
    wordCount.textContent = `${result.draft.wordCount || 0} words`;
  }

  if (charCount) {
    charCount.textContent = `${result.draft.charCount || 0} characters`;
  }

  // Show draft source
  if (draftSource && result.draft.source) {
    const sourceLabels = {
      'ai-enriched': '🤖 AI-Personalized',
      'template-enriched': '📝 Template-Personalized',
      'ai': '🤖 AI',
      'template': '📝 Template'
    };
    draftSource.textContent = sourceLabels[result.draft.source] || '';
  }

  // Show alternate subject lines if available
  if (result.draft.alternateSubjects && result.draft.alternateSubjects.length > 0) {
    displayAlternateSubjects(result.draft.alternateSubjects);
  }

  // Show personalization insights
  if (result.draft.icebreaker || result.draft.companyInsights) {
    displayPersonalizationInsights(result.draft, result.contact);
  }

  // Initialize undo/redo buttons
  updateUndoRedoButtons();

  // Focus on the first action button for keyboard navigation
  setTimeout(() => {
    const sendBtn = document.getElementById('magic-send-gmail');
    if (sendBtn) {
      sendBtn.focus();
    }
  }, 100);
}

function displayAlternateSubjects(alternateSubjects) {
  const showBtn = document.getElementById('show-alt-subjects');
  const container = document.getElementById('alt-subjects-container');
  const list = document.getElementById('alt-subjects-list');

  if (!showBtn || !container || !list) return;

  showBtn.style.display = 'inline-block';

  // Clear existing
  list.innerHTML = '';

  // Add alternates
  alternateSubjects.forEach((alt, i) => {
    const option = document.createElement('div');
    option.className = 'alt-subject-option';
    option.innerHTML = `
      <div class="alt-subject-text">${escapeHtml(alt.text)}</div>
      <div class="alt-subject-meta">
        <span class="alt-subject-score">${alt.score}/100</span>
        <span class="alt-subject-category">${alt.category}</span>
        <button class="use-subject-btn" data-subject="${escapeHtml(alt.text)}">Use This</button>
      </div>
    `;
    list.appendChild(option);
  });

  // Toggle visibility
  showBtn.onclick = () => {
    const isVisible = container.style.display === 'block';
    container.style.display = isVisible ? 'none' : 'block';
    showBtn.textContent = isVisible ? '↔️' : '↕️';
  };

  // Use button handlers
  list.querySelectorAll('.use-subject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const subject = e.target.dataset.subject;
      const subjectInput = document.getElementById('magic-draft-subject');
      if (subjectInput) {
        subjectInput.value = subject;
        container.style.display = 'none';
        showBtn.textContent = '↔️';
        showToast('Subject line updated!');
      }
    });
  });
}

function displayPersonalizationInsights(draft, contact) {
  const insightsContainer = document.getElementById('personalization-insights');
  const insightsContent = document.getElementById('insights-content');
  const toggleBtn = document.getElementById('toggle-insights');

  if (!insightsContainer || !insightsContent) return;

  insightsContainer.style.display = 'block';

  const insights = [];

  // Add icebreaker info
  if (draft.icebreaker && draft.icebreaker.text) {
    insights.push({
      icon: '👋',
      label: 'Icebreaker',
      text: draft.icebreaker.text,
      type: draft.icebreaker.type,
      confidence: draft.icebreaker.confidence
    });
  }

  // Add company insights
  if (draft.companyInsights) {
    const ci = draft.companyInsights;

    if (ci.recentNews && ci.recentNews.length > 0) {
      insights.push({
        icon: '📰',
        label: 'Recent News',
        text: ci.recentNews[0],
        type: 'company'
      });
    }

    if (ci.keywords && ci.keywords.length > 0) {
      insights.push({
        icon: '🔑',
        label: 'Key Themes',
        text: ci.keywords.slice(0, 3).join(', '),
        type: 'company'
      });
    }
  }

  // Add shared context
  if (contact) {
    if (contact.school) {
      insights.push({
        icon: '🎓',
        label: 'Education',
        text: contact.school,
        type: 'shared'
      });
    }

    if (contact.mutualConnections > 0) {
      insights.push({
        icon: '👥',
        label: 'Mutual Connections',
        text: `${contact.mutualConnections} connection${contact.mutualConnections > 1 ? 's' : ''}`,
        type: 'shared'
      });
    }

    if (contact.recentPosts && contact.recentPosts.length > 0) {
      insights.push({
        icon: '📝',
        label: 'Recent Activity',
        text: contact.recentPosts[0].snippet.substring(0, 80) + '...',
        type: 'activity'
      });
    }
  }

  // Render insights
  insightsContent.innerHTML = insights.map(insight => `
    <div class="insight-item">
      <span class="insight-icon">${insight.icon}</span>
      <div class="insight-details">
        <div class="insight-label">${insight.label}</div>
        <div class="insight-text">${escapeHtml(insight.text)}</div>
        ${insight.confidence ? `<div class="insight-confidence">${insight.confidence}% match</div>` : ''}
      </div>
    </div>
  `).join('');

  // Toggle handler
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const isVisible = insightsContent.style.display === 'block';
      insightsContent.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? '▼' : '▲';
    };
  }
}

function resetToLinkedInMode() {
  document.getElementById('magic-progress-container').style.display = 'none';
  document.getElementById('magic-results-container').style.display = 'none';
  document.getElementById('linkedin-mode').style.display = 'block';
}

function getContactInitials(contact) {
  const first = contact.firstName?.[0] || '';
  const last = contact.lastName?.[0] || '';
  return (first + last).toUpperCase();
}

function toggleQuickEdit() {
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');
  const editBtn = document.getElementById('magic-quick-edit');

  const isReadOnly = subjectInput.hasAttribute('readonly');

  if (isReadOnly) {
    // Enable editing
    subjectInput.removeAttribute('readonly');
    bodyInput.removeAttribute('readonly');
    subjectInput.focus();
    editBtn.textContent = '💾';
    editBtn.title = 'Save changes (Ctrl+E)';

    // Enable undo/redo buttons
    updateUndoRedoButtons();
  } else {
    // Save and disable editing
    subjectInput.setAttribute('readonly', 'readonly');
    bodyInput.setAttribute('readonly', 'readonly');
    editBtn.textContent = '✏️';
    editBtn.title = 'Quick edit (Ctrl+E)';

    // Update draft in workflow
    updateDraftFromInputs();
  }
}

function handleUndo() {
  if (typeof magicWorkflow !== 'undefined') {
    const draft = magicWorkflow.undo();
    if (draft) {
      updateDraftUI(draft);
      updateUndoRedoButtons();
    }
  }
}

function handleRedo() {
  if (typeof magicWorkflow !== 'undefined') {
    const draft = magicWorkflow.redo();
    if (draft) {
      updateDraftUI(draft);
      updateUndoRedoButtons();
    }
  }
}

function updateUndoRedoButtons() {
  if (typeof magicWorkflow === 'undefined') return;

  const undoBtn = document.getElementById('magic-undo');
  const redoBtn = document.getElementById('magic-redo');

  if (undoBtn) {
    undoBtn.disabled = magicWorkflow.historyIndex <= 0;
  }

  if (redoBtn) {
    redoBtn.disabled = magicWorkflow.historyIndex >= magicWorkflow.draftHistory.length - 1;
  }
}

function updateDraftUI(draft) {
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');
  const wordCount = document.getElementById('magic-word-count');
  const charCount = document.getElementById('magic-char-count');

  if (subjectInput) subjectInput.value = draft.subject;
  if (bodyInput) bodyInput.value = draft.body;
  if (wordCount) wordCount.textContent = `${draft.wordCount || 0} words`;
  if (charCount) charCount.textContent = `${draft.charCount || 0} characters`;
}

function updateDraftFromInputs() {
  const subjectInput = document.getElementById('magic-draft-subject');
  const bodyInput = document.getElementById('magic-draft-body');
  const wordCount = document.getElementById('magic-word-count');
  const charCount = document.getElementById('magic-char-count');

  if (subjectInput && bodyInput) {
    const subject = subjectInput.value;
    const body = bodyInput.value;

    // Update word/char count
    const words = body.split(/\s+/).filter(w => w.length > 0).length;
    const chars = body.length;

    if (wordCount) {
      wordCount.textContent = `${words} words`;
    }

    if (charCount) {
      charCount.textContent = `${chars} characters`;
    }

    // Update workflow draft
    if (typeof magicWorkflow !== 'undefined') {
      magicWorkflow.updateDraft(subject, body);
      updateUndoRedoButtons();
    }
  }
}

function sendViaGmail() {
  const subject = document.getElementById('magic-draft-subject').value;
  const body = document.getElementById('magic-draft-body').value;
  const email = selectedEmail || '';

  // URL encode
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const encodedEmail = encodeURIComponent(email);

  // Open Gmail compose
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;

  chrome.tabs.create({ url: gmailUrl });

  // Track send for onboarding
  trackOnboardingProgress('send');

  // Track analytics
  if (currentContact && extractedData) {
    const draft = {
      subject: subject,
      body: body,
      to: email,
      templateUsed: selectedTemplate || 'Magic Extract',
      generatedByAI: extractedData.isAIGenerated || true,
      aiModel: 'claude-3-sonnet-20240229',
      aiCost: 0.001 // Approximate cost
    };
    trackEmailSent(currentContact, draft, 'gmail');
  }

  // Show success message
  showSendSuccessToast('Gmail');

  // Auto-save contact after sending
  saveMagicContact();
}

function sendViaOutlook() {
  const subject = document.getElementById('magic-draft-subject').value;
  const body = document.getElementById('magic-draft-body').value;
  const email = selectedEmail || '';

  // URL encode
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const encodedEmail = encodeURIComponent(email);

  // Open Outlook compose
  const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodedEmail}&subject=${encodedSubject}&body=${encodedBody}`;

  chrome.tabs.create({ url: outlookUrl });

  // Track analytics
  if (currentContact && extractedData) {
    const draft = {
      subject: subject,
      body: body,
      to: email,
      templateUsed: selectedTemplate || 'Magic Extract',
      generatedByAI: extractedData.isAIGenerated || true,
      aiModel: 'claude-3-sonnet-20240229',
      aiCost: 0.001
    };
    trackEmailSent(currentContact, draft, 'outlook');
  }

  // Show success message
  showSendSuccessToast('Outlook');

  // Auto-save contact after sending
  saveMagicContact();
}

function copyMagicDraft() {
  const subject = document.getElementById('magic-draft-subject').value;
  const body = document.getElementById('magic-draft-body').value;
  const email = selectedEmail || '';

  const fullDraft = `Subject: ${subject}\n\n${body}`;

  navigator.clipboard.writeText(fullDraft).then(() => {
    const btn = document.getElementById('magic-copy-draft');
    const originalText = btn.innerHTML;

    btn.innerHTML = '✓ Copied!';
    btn.disabled = true;

    // Track analytics (clipboard copy)
    if (currentContact && extractedData) {
      const draft = {
        subject: subject,
        body: body,
        to: email,
        templateUsed: selectedTemplate || 'Magic Extract',
        generatedByAI: extractedData.isAIGenerated || true,
        aiModel: 'claude-3-sonnet-20240229',
        aiCost: 0.001
      };
      trackEmailSent(currentContact, draft, 'clipboard');
    }

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
  });
}

function showSendSuccessToast(platform) {
  const toast = document.createElement('div');
  toast.className = 'magic-success-toast';
  toast.innerHTML = `
    <div class="success-icon">✓</div>
    <div class="success-message">
      <strong>Opening ${platform}...</strong>
      <span>Your draft is ready to send</span>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

async function saveMagicContact() {
  if (!currentContact || !selectedEmail) return;

  try {
    const selectedPattern = currentContact.emails?.find(e => e.email === selectedEmail);

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
      source: 'magic-workflow',
    };

    const result = await apiClient.saveContact(contactData);

    if (result.success) {
      await storage.saveRecentContact({
        id: result.contact.id,
        name: `${currentContact.firstName} ${currentContact.lastName}`,
        company: currentContact.company,
        email: selectedEmail,
      });

      await loadRecentContacts();
      console.log('[Magic] Contact auto-saved');
    }
  } catch (error) {
    console.error('[Magic] Auto-save error:', error);
    // Don't show error to user - auto-save is optional
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

// ==========================================
// ONBOARDING & FIRST-TIME USER EXPERIENCE
// ==========================================

async function initializeOnboarding() {
  // Check if first-time user
  const hasSeenTour = await onboardingTour.hasSeenTour();

  if (!hasSeenTour) {
    // Show welcome screen first
    showWelcomeScreen();
  } else {
    // Show checklist if not complete
    const shouldShowChecklist = await onboardingChecklist.shouldShow();
    if (shouldShowChecklist) {
      onboardingChecklist.show();
    }

    // Show contextual help
    const context = await EmptyStates.detectContext();
    EmptyStates.showContextualHelp(context);
  }

  // Update empty queue display
  updateQueueEmptyState();
}

function showWelcomeScreen() {
  const welcomeHtml = EmptyStates.renderWelcome();
  const welcomeContainer = document.createElement('div');
  welcomeContainer.innerHTML = welcomeHtml;
  welcomeContainer.className = 'welcome-container';

  // Insert at top of container
  const container = document.querySelector('.container');
  container.insertBefore(welcomeContainer, container.firstChild);

  // Event listeners
  document.getElementById('start-tour-btn')?.addEventListener('click', () => {
    welcomeContainer.remove();
    onboardingTour.start();
  });

  document.getElementById('skip-tour-btn')?.addEventListener('click', async () => {
    welcomeContainer.remove();
    await chrome.storage.local.set({ hasSeenTour: true });
    onboardingChecklist.show();
  });
}

function updateQueueEmptyState() {
  const queueList = document.getElementById('queue-list');
  if (!queueList) return;

  contactQueue.getQueue().then(queue => {
    if (queue.length === 0) {
      queueList.innerHTML = EmptyStates.renderEmptyQueue();
    }
  });
}

// Track onboarding progress
async function trackOnboardingProgress(event, data) {
  switch (event) {
    case 'linkedin-visit':
      await onboardingChecklist.onLinkedInVisit();
      await chrome.storage.local.set({ hasVisitedLinkedIn: true });
      break;

    case 'extract':
      await onboardingChecklist.onExtract();
      await chrome.storage.local.set({ hasExtracted: true });
      break;

    case 'generate':
      await onboardingChecklist.onGenerate();
      await chrome.storage.local.set({ hasGenerated: true });
      break;

    case 'send':
      await onboardingChecklist.onSend();
      const stats = await chrome.storage.local.get(['sentCount']);
      const newCount = (stats.sentCount || 0) + 1;
      await chrome.storage.local.set({
        hasSent: true,
        sentCount: newCount
      });
      break;
  }
}

// ==========================================
// NAVIGATION TABS
// ==========================================

function setupNavigationTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  const queueContainer = document.getElementById('queue-view-container');
  const draftsContainer = document.getElementById('drafts-view-container');
  const analyticsContainer = document.getElementById('analytics-view-container');
  const navTabsContainer = document.getElementById('nav-tabs');

  // Show tabs when queue has contacts
  contactQueue.getQueue().then(queue => {
    if (queue.length > 0) {
      navTabsContainer.style.display = 'flex';
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');

      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));

      // Add active class to clicked tab
      tab.classList.add('active');

      // Hide all views
      queueContainer.style.display = 'none';
      draftsContainer.style.display = 'none';
      analyticsContainer.style.display = 'none';

      // Show selected view
      if (view === 'queue') {
        queueContainer.style.display = 'block';
      } else if (view === 'drafts') {
        draftsContainer.style.display = 'block';
        if (typeof openDraftsView === 'function') {
          openDraftsView();
        }
      } else if (view === 'analytics') {
        analyticsContainer.style.display = 'block';
        analyticsView.render();
      }
    });
  });
}

// Show navigation tabs
function showNavigationTabs() {
  const navTabsContainer = document.getElementById('nav-tabs');
  if (navTabsContainer) {
    navTabsContainer.style.display = 'flex';
  }
}

// Switch to specific tab
function switchToTab(tabName) {
  const tab = document.querySelector(`.nav-tab[data-view="${tabName}"]`);
  if (tab) {
    tab.click();
  }
}

// ==========================================
// ANALYTICS TRACKING
// ==========================================

async function trackEmailSent(contact, draft, method) {
  if (typeof analyticsTracker !== 'undefined') {
    try {
      await analyticsTracker.trackEmailSent(contact, draft, method);
      console.log('[Analytics] Email tracked');

      // Show analytics tab after first send
      showNavigationTabs();
    } catch (error) {
      console.error('[Analytics] Tracking error:', error);
    }
  }
}

// Show help for "?" key
document.addEventListener('keydown', (e) => {
  if (e.key === '?' && !e.target.matches('input, textarea')) {
    e.preventDefault();
    keyboardShortcuts.showHelp();
  }
});
