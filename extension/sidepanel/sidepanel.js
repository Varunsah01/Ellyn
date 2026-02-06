// Extension sidebar main logic

let currentContact = null;
let selectedEmail = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Ellyn] Sidebar loaded');

  // Load recent contacts
  await loadRecentContacts();

  // Setup form handler
  document.getElementById('contact-form').addEventListener('submit', handleSubmit);

  // Setup sync button
  document.getElementById('sync-btn').addEventListener('click', handleSync);

  // Setup save button
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

  // Setup web app button
  const webAppBtn = document.getElementById('open-web-app-btn');
  if (webAppBtn) {
    webAppBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000/contacts' });
    });
  }
});

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();

  const formData = {
    firstName: document.getElementById('firstName').value,
    lastName: document.getElementById('lastName').value,
    company: document.getElementById('company').value,
    role: document.getElementById('role').value || '',
  };

  // Show loading
  showLoading(true);

  try {
    // Call web app API
    const result = await apiClient.enrichContact(formData);

    if (!result.success) {
      throw new Error(result.error || 'Enrichment failed');
    }

    // Store current contact
    currentContact = {
      ...formData,
      enrichment: result.enrichment,
      emails: result.emails,
      cost: result.cost,
    };

    // Display results
    displayResults(result);

  } catch (error) {
    console.error('[Ellyn] Enrichment error:', error);
    alert('Failed to discover email: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// Display enrichment results
function displayResults(result) {
  // Show results section
  document.getElementById('results').style.display = 'block';

  // Display company info
  document.getElementById('domain').textContent = result.enrichment.domain || '-';
  document.getElementById('industry').textContent = result.enrichment.industry || '-';
  document.getElementById('company-size').textContent = result.enrichment.size || '-';

  // Display email patterns
  const emailList = document.getElementById('email-list');
  emailList.innerHTML = '';

  if (!result.emails || result.emails.length === 0) {
    emailList.innerHTML = '<p style="color: #6b7280; font-size: 12px;">No email patterns found</p>';
    return;
  }

  result.emails.forEach((pattern) => {
    const card = document.createElement('div');
    card.className = 'email-card';
    card.onclick = () => selectEmail(pattern.email);

    const confidenceClass = pattern.confidence >= 70 ? 'confidence-high' :
                            pattern.confidence >= 50 ? 'confidence-medium' :
                            'confidence-low';

    card.innerHTML = `
      <div class="email-address">${pattern.email}</div>
      <div class="email-meta">
        <span>${pattern.pattern}</span>
        <span class="confidence-badge ${confidenceClass}">${pattern.confidence}%</span>
      </div>
    `;

    emailList.appendChild(card);
  });
}

// Select email pattern
function selectEmail(email) {
  selectedEmail = email;

  // Update UI
  document.querySelectorAll('.email-card').forEach(card => {
    card.classList.remove('selected');
    if (card.querySelector('.email-address').textContent === email) {
      card.classList.add('selected');
    }
  });
}

// Save contact
async function handleSave() {
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
      companyDomain: currentContact.enrichment.domain,
      companyIndustry: currentContact.enrichment.industry,
      companySize: currentContact.enrichment.size,
      source: 'extension',
    };

    const result = await apiClient.saveContact(contactData);

    if (result.success) {
      // Save to local storage for recent list
      await storage.saveRecentContact({
        id: result.contact.id,
        name: `${currentContact.firstName} ${currentContact.lastName}`,
        company: currentContact.company,
        email: selectedEmail,
      });

      alert(' Contact saved successfully!');

      // Reload recent contacts
      await loadRecentContacts();

      // Reset form
      document.getElementById('contact-form').reset();
      document.getElementById('results').style.display = 'none';
      selectedEmail = null;
      currentContact = null;
    } else {
      alert('Failed to save contact: ' + (result.error || 'Unknown error'));
    }

  } catch (error) {
    console.error('[Ellyn] Save error:', error);
    alert('Failed to save contact: ' + error.message);
  }
}

// Load recent contacts
async function loadRecentContacts() {
  const recentList = document.getElementById('recent-list');
  const contacts = await storage.getRecentContacts();

  if (contacts.length === 0) {
    recentList.innerHTML = '<p style="color: #9ca3af; font-size: 12px;">No recent contacts</p>';
    return;
  }

  recentList.innerHTML = contacts.map(contact => `
    <div class="recent-item">
      <div class="recent-name">${contact.name}</div>
      <div class="recent-company">${contact.company}</div>
    </div>
  `).join('');
}

// Sync with web app
async function handleSync() {
  try {
    const contacts = await apiClient.getRecentContacts(5);

    // Update local storage
    for (const contact of contacts) {
      await storage.saveRecentContact({
        id: contact.id,
        name: contact.full_name,
        company: contact.company,
        email: contact.inferred_email || contact.confirmed_email,
      });
    }

    await loadRecentContacts();
    alert(' Synced with web app');

  } catch (error) {
    console.error('[Ellyn] Sync error:', error);
    alert('Sync failed: ' + error.message);
  }
}

// Show/hide loading
function showLoading(show) {
  const button = document.querySelector('form button[type="submit"]');
  if (show) {
    button.disabled = true;
    button.innerHTML = '<span class="loading">Enriching...</span>';
  } else {
    button.disabled = false;
    button.innerHTML = '= Discover Email';
  }
}
