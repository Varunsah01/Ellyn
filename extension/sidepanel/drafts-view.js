// Drafts View - Manage and send generated drafts
// Shows all contacts with ready drafts

class DraftsView {
  constructor() {
    this.currentView = 'list'; // list | detail
    this.selectedDraftId = null;
  }

  /**
   * Render drafts view
   */
  async render() {
    const stats = await contactQueue.getQueueStats();
    const readyDrafts = await contactQueue.getContactsByStatus('ready');
    const sentDrafts = await contactQueue.getContactsByStatus('sent');

    const container = document.getElementById('drafts-view-container');
    if (!container) {
      console.error('[DraftsView] Container not found');
      return;
    }

    container.innerHTML = `
      <div class="drafts-view">
        <!-- Header -->
        <div class="drafts-header">
          <button id="back-to-queue" class="icon-btn">← Back</button>
          <h2>Ready to Send (${readyDrafts.length})</h2>
          <button id="refresh-drafts" class="icon-btn">↻</button>
        </div>

        <!-- Stats -->
        <div class="drafts-stats">
          <div class="stat-card">
            <div class="stat-number">${readyDrafts.length}</div>
            <div class="stat-label">Ready</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${sentDrafts.length}</div>
            <div class="stat-label">Sent</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="drafts-tabs">
          <button class="tab-btn active" data-tab="ready">Ready (${readyDrafts.length})</button>
          <button class="tab-btn" data-tab="sent">Sent (${sentDrafts.length})</button>
        </div>

        <!-- Ready Drafts List -->
        <div class="tab-content active" data-tab-content="ready">
          ${readyDrafts.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <p>No drafts ready to send</p>
              <button id="go-to-queue" class="secondary-btn">Add Contacts to Queue</button>
            </div>
          ` : `
            <div class="draft-list">
              ${readyDrafts.map(contact => this.renderDraftCard(contact)).join('')}
            </div>

            <div class="bulk-actions">
              <button id="send-all-gmail" class="primary-btn">
                📧 Send All via Gmail (${readyDrafts.length})
              </button>
              <button id="export-all-drafts" class="secondary-btn">
                📥 Export All (CSV)
              </button>
            </div>
          `}
        </div>

        <!-- Sent Drafts List -->
        <div class="tab-content" data-tab-content="sent">
          ${sentDrafts.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📬</div>
              <p>No sent drafts yet</p>
            </div>
          ` : `
            <div class="draft-list">
              ${sentDrafts.map(contact => this.renderSentCard(contact)).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render draft card
   */
  renderDraftCard(contact) {
    const wordCount = contact.draft?.body?.split(/\s+/).length || 0;
    const preview = this.truncate(contact.draft?.body || '', 100);

    return `
      <div class="draft-card" data-contact-id="${contact.id}">
        <div class="draft-card-header">
          <div class="contact-avatar">${this.getInitials(contact)}</div>
          <div class="contact-details">
            <div class="contact-name">${this.escapeHtml(contact.firstName)} ${this.escapeHtml(contact.lastName)}</div>
            <div class="contact-role">${this.escapeHtml(contact.role || 'No role')}</div>
            <div class="contact-company">${this.escapeHtml(contact.company || 'No company')}</div>
          </div>
          <div class="draft-meta">
            <span class="draft-source">${contact.draft?.source === 'ai' ? '🤖 AI' : '📝 Template'}</span>
            <span class="draft-words">${wordCount} words</span>
          </div>
        </div>

        <div class="draft-content">
          <div class="draft-subject">
            <strong>Subject:</strong> ${this.escapeHtml(contact.draft?.subject || '')}
          </div>
          <div class="draft-preview">
            ${this.escapeHtml(preview)}${preview.length < contact.draft?.body?.length ? '...' : ''}
          </div>
        </div>

        <div class="draft-actions">
          <button class="action-btn primary" data-action="send" data-contact-id="${contact.id}">
            📧 Send via Gmail
          </button>
          <button class="action-btn secondary" data-action="edit" data-contact-id="${contact.id}">
            ✏️ Edit
          </button>
          <button class="action-btn tertiary" data-action="copy" data-contact-id="${contact.id}">
            📋 Copy
          </button>
          <button class="action-btn danger" data-action="delete" data-contact-id="${contact.id}">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render sent card
   */
  renderSentCard(contact) {
    const sentDate = new Date(contact.sentAt).toLocaleString();

    return `
      <div class="draft-card sent">
        <div class="draft-card-header">
          <div class="contact-avatar">${this.getInitials(contact)}</div>
          <div class="contact-details">
            <div class="contact-name">${this.escapeHtml(contact.firstName)} ${this.escapeHtml(contact.lastName)}</div>
            <div class="contact-role">${this.escapeHtml(contact.role || 'No role')}</div>
            <div class="contact-company">${this.escapeHtml(contact.company || 'No company')}</div>
          </div>
          <div class="sent-badge">✓ Sent</div>
        </div>

        <div class="draft-content">
          <div class="draft-subject">
            <strong>Subject:</strong> ${this.escapeHtml(contact.draft?.subject || '')}
          </div>
          <div class="sent-date">Sent: ${sentDate}</div>
        </div>

        <div class="draft-actions">
          <button class="action-btn secondary" data-action="view" data-contact-id="${contact.id}">
            👁️ View
          </button>
          <button class="action-btn tertiary" data-action="copy" data-contact-id="${contact.id}">
            📋 Copy
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Back button
    const backBtn = document.getElementById('back-to-queue');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-drafts');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.render());
    }

    // Go to queue button
    const goToQueueBtn = document.getElementById('go-to-queue');
    if (goToQueueBtn) {
      goToQueueBtn.addEventListener('click', () => this.goBack());
    }

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Draft actions
    const actionBtns = document.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const contactId = e.currentTarget.dataset.contactId;
        this.handleAction(action, contactId);
      });
    });

    // Bulk actions
    const sendAllBtn = document.getElementById('send-all-gmail');
    if (sendAllBtn) {
      sendAllBtn.addEventListener('click', () => this.sendAllViaGmail());
    }

    const exportAllBtn = document.getElementById('export-all-drafts');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.exportAllDrafts());
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabName);
    });
  }

  /**
   * Handle draft actions
   */
  async handleAction(action, contactId) {
    const queue = await contactQueue.getQueue();
    const contact = queue.find(c => c.id === contactId);

    if (!contact) {
      alert('Contact not found');
      return;
    }

    switch (action) {
      case 'send':
        this.sendViaGmail(contact);
        break;
      case 'edit':
        this.editDraft(contact);
        break;
      case 'copy':
        this.copyDraft(contact);
        break;
      case 'delete':
        this.deleteDraft(contactId);
        break;
      case 'view':
        this.viewDraft(contact);
        break;
    }
  }

  /**
   * Send draft via Gmail
   */
  async sendViaGmail(contact) {
    const subject = contact.draft?.subject || '';
    const body = contact.draft?.body || '';
    const email = contact.selectedEmail || contact.emails?.[0]?.email || '';

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const encodedEmail = encodeURIComponent(email);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;

    chrome.tabs.create({ url: gmailUrl });

    // Mark as sent
    await contactQueue.markAsSent(contact.id);

    // Show success message
    this.showToast(`Email draft opened for ${contact.firstName} ${contact.lastName}`);

    // Refresh view
    setTimeout(() => this.render(), 1000);
  }

  /**
   * Send all drafts via Gmail
   */
  async sendAllViaGmail() {
    const readyDrafts = await contactQueue.getContactsByStatus('ready');

    if (readyDrafts.length === 0) {
      alert('No drafts ready to send');
      return;
    }

    const confirmed = confirm(
      `This will open ${readyDrafts.length} Gmail compose tabs. Continue?`
    );

    if (!confirmed) return;

    for (let i = 0; i < readyDrafts.length; i++) {
      const contact = readyDrafts[i];
      const subject = contact.draft?.subject || '';
      const body = contact.draft?.body || '';
      const email = contact.selectedEmail || contact.emails?.[0]?.email || '';

      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      const encodedEmail = encodeURIComponent(email);

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedEmail}&su=${encodedSubject}&body=${encodedBody}`;

      chrome.tabs.create({ url: gmailUrl, active: false });

      // Mark as sent
      await contactQueue.markAsSent(contact.id);

      // Rate limit: 1 tab per second
      if (i < readyDrafts.length - 1) {
        await this.sleep(1000);
      }
    }

    this.showToast(`Opened ${readyDrafts.length} Gmail compose tabs!`);
    setTimeout(() => this.render(), 2000);
  }

  /**
   * Export all drafts to CSV
   */
  async exportAllDrafts() {
    try {
      const csv = await contactQueue.exportToCSV();
      this.downloadCSV(csv, 'ellyn-drafts.csv');
      this.showToast('Drafts exported successfully!');
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  }

  /**
   * Edit draft
   */
  editDraft(contact) {
    // Show edit modal
    const modal = this.createEditModal(contact);
    document.body.appendChild(modal);
  }

  /**
   * Create edit modal
   */
  createEditModal(contact) {
    const modal = document.createElement('div');
    modal.className = 'draft-edit-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Draft for ${this.escapeHtml(contact.firstName)} ${this.escapeHtml(contact.lastName)}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <label>Subject:</label>
          <input type="text" id="edit-subject" value="${this.escapeHtml(contact.draft?.subject || '')}" />

          <label>Body:</label>
          <textarea id="edit-body" rows="15">${this.escapeHtml(contact.draft?.body || '')}</textarea>

          <div class="draft-meta">
            <span id="edit-word-count">${contact.draft?.body?.split(/\s+/).length || 0} words</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn modal-cancel">Cancel</button>
          <button class="primary-btn modal-save" data-contact-id="${contact.id}">Save Changes</button>
        </div>
      </div>
    `;

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('.modal-save').addEventListener('click', async (e) => {
      const newSubject = document.getElementById('edit-subject').value;
      const newBody = document.getElementById('edit-body').value;

      await contactQueue.updateContactStatus(contact.id, 'ready', {
        draft: {
          ...contact.draft,
          subject: newSubject,
          body: newBody
        }
      });

      modal.remove();
      this.render();
      this.showToast('Draft updated!');
    });

    // Live word count
    const bodyInput = modal.querySelector('#edit-body');
    bodyInput.addEventListener('input', () => {
      const words = bodyInput.value.split(/\s+/).filter(w => w).length;
      modal.querySelector('#edit-word-count').textContent = `${words} words`;
    });

    return modal;
  }

  /**
   * Copy draft to clipboard
   */
  copyDraft(contact) {
    const fullDraft = `Subject: ${contact.draft?.subject}\n\n${contact.draft?.body}`;

    navigator.clipboard.writeText(fullDraft).then(() => {
      this.showToast('Draft copied to clipboard!');
    });
  }

  /**
   * View draft (for sent items)
   */
  viewDraft(contact) {
    const modal = document.createElement('div');
    modal.className = 'draft-view-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${this.escapeHtml(contact.firstName)} ${this.escapeHtml(contact.lastName)}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="view-subject"><strong>Subject:</strong> ${this.escapeHtml(contact.draft?.subject || '')}</div>
          <div class="view-body">${this.escapeHtml(contact.draft?.body || '').replace(/\n/g, '<br>')}</div>
          <div class="view-meta">
            <span>Sent: ${new Date(contact.sentAt).toLocaleString()}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn modal-close">Close</button>
        </div>
      </div>
    `;

    modal.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', () => modal.remove());
    });

    document.body.appendChild(modal);
  }

  /**
   * Delete draft
   */
  async deleteDraft(contactId) {
    const confirmed = confirm('Remove this draft from queue?');
    if (!confirmed) return;

    await contactQueue.removeFromQueue(contactId);
    this.showToast('Draft removed');
    this.render();
  }

  /**
   * Go back to main view
   */
  goBack() {
    document.getElementById('drafts-view-container').style.display = 'none';
    document.getElementById('queue-view-container').style.display = 'block';
  }

  /**
   * Helper: Get initials
   */
  getInitials(contact) {
    const first = contact.firstName?.[0] || '';
    const last = contact.lastName?.[0] || '';
    return (first + last).toUpperCase();
  }

  /**
   * Helper: Truncate text
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength);
  }

  /**
   * Helper: Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Helper: Download CSV
   */
  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Helper: Show toast notification
   */
  showToast(message) {
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

  /**
   * Helper: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export instance
const draftsView = new DraftsView();
