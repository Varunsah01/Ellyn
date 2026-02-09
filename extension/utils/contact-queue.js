// Contact Queue Management
// Handles multiple contacts extraction, queuing, and batch operations

class ContactQueue {
  constructor() {
    this.storage = chrome.storage.local;
    this.maxQueueSize = 50;
    this.rateLimitDelay = 2000; // 2 seconds between API calls
  }

  /**
   * Get all contacts in queue
   * @returns {Promise<Array>} - Array of queued contacts
   */
  async getQueue() {
    const result = await this.storage.get(['contactQueue']);
    return result.contactQueue || [];
  }

  /**
   * Add contact to queue
   * @param {Object} contact - Contact data
   * @returns {Promise<Object>} - Updated queue
   */
  async addToQueue(contact) {
    const queue = await this.getQueue();

    // Check if already in queue (by LinkedIn URL)
    const exists = queue.find(c => c.profileUrl === contact.profileUrl);
    if (exists) {
      throw new Error('Contact already in queue');
    }

    // Check queue size limit
    if (queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max ${this.maxQueueSize} contacts)`);
    }

    // Add contact with metadata
    const queuedContact = {
      ...contact,
      id: this.generateId(),
      addedAt: Date.now(),
      status: 'pending', // pending | generating | ready | sent | error
      draft: null,
      error: null
    };

    queue.push(queuedContact);
    await this.storage.set({ contactQueue: queue });

    return queuedContact;
  }

  /**
   * Remove contact from queue
   * @param {string} contactId - Contact ID
   */
  async removeFromQueue(contactId) {
    const queue = await this.getQueue();
    const filtered = queue.filter(c => c.id !== contactId);
    await this.storage.set({ contactQueue: filtered });
  }

  /**
   * Clear entire queue
   */
  async clearQueue() {
    await this.storage.set({ contactQueue: [] });
  }

  /**
   * Update contact status
   * @param {string} contactId - Contact ID
   * @param {string} status - New status
   * @param {Object} data - Additional data (draft, error, etc.)
   */
  async updateContactStatus(contactId, status, data = {}) {
    const queue = await this.getQueue();
    const contact = queue.find(c => c.id === contactId);

    if (!contact) {
      throw new Error('Contact not found in queue');
    }

    contact.status = status;
    Object.assign(contact, data);

    await this.storage.set({ contactQueue: queue });
  }

  /**
   * Get contacts by status
   * @param {string} status - Status to filter by
   * @returns {Promise<Array>}
   */
  async getContactsByStatus(status) {
    const queue = await this.getQueue();
    return queue.filter(c => c.status === status);
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>}
   */
  async getQueueStats() {
    const queue = await this.getQueue();

    return {
      total: queue.length,
      pending: queue.filter(c => c.status === 'pending').length,
      generating: queue.filter(c => c.status === 'generating').length,
      ready: queue.filter(c => c.status === 'ready').length,
      sent: queue.filter(c => c.status === 'sent').length,
      error: queue.filter(c => c.status === 'error').length
    };
  }

  /**
   * Batch generate drafts for all pending contacts
   * @param {Function} onProgress - Progress callback (current, total, contact)
   * @returns {Promise<Object>} - Results summary
   */
  async batchGenerateDrafts(onProgress) {
    const pending = await this.getContactsByStatus('pending');

    if (pending.length === 0) {
      throw new Error('No pending contacts to generate drafts for');
    }

    const results = {
      total: pending.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < pending.length; i++) {
      const contact = pending[i];

      try {
        // Update status to generating
        await this.updateContactStatus(contact.id, 'generating');

        // Notify progress
        if (onProgress) {
          onProgress(i + 1, pending.length, contact);
        }

        // Generate draft
        const draft = await this.generateDraftForContact(contact);

        // Update with draft
        await this.updateContactStatus(contact.id, 'ready', { draft });

        results.success++;

        // Rate limiting - wait between requests
        if (i < pending.length - 1) {
          await this.sleep(this.rateLimitDelay);
        }

      } catch (error) {
        console.error(`[Queue] Failed to generate draft for ${contact.firstName}:`, error);

        await this.updateContactStatus(contact.id, 'error', {
          error: error.message
        });

        results.failed++;
        results.errors.push({
          contact: `${contact.firstName} ${contact.lastName}`,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Generate draft for a single contact
   * @param {Object} contact - Contact data
   * @returns {Promise<Object>} - Draft {subject, body}
   */
  async generateDraftForContact(contact) {
    // Use the same logic as magic workflow
    try {
      // Get user profile for personalization
      const userProfile = await storage.getUserProfile();

      // Detect role and select template
      const detection = roleDetector.detectRecruiterRole(
        contact.role || '',
        contact.company || ''
      );

      // Try AI generation first
      const aiResult = await apiClient.enrichContact({
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        role: contact.role,
        generateDraft: true,
        email: contact.selectedEmail || contact.emails?.[0]?.email
      });

      if (aiResult.draft) {
        return {
          subject: this.extractSubject(aiResult.draft),
          body: this.extractBody(aiResult.draft),
          source: 'ai',
          generatedAt: Date.now()
        };
      }
    } catch (error) {
      console.log('[Queue] AI generation failed, using template');
    }

    // Fallback to template
    const userProfile = await storage.getUserProfile();
    const detection = roleDetector.detectRecruiterRole(
      contact.role || '',
      contact.company || ''
    );

    const template = recruiterTemplates.generateTemplate(
      detection.recommendedTemplate,
      contact,
      userProfile
    );

    // Enhance with company context
    let fullDraft = `Subject: ${template.subject}\n\n${template.body}`;
    fullDraft = recruiterTemplates.enhanceWithCompanyContext(
      fullDraft,
      contact.company
    );

    return {
      subject: template.subject,
      body: template.body,
      source: 'template',
      generatedAt: Date.now()
    };
  }

  /**
   * Export queue to CSV
   * @returns {Promise<string>} - CSV data
   */
  async exportToCSV() {
    const queue = await this.getQueue();

    const headers = [
      'First Name',
      'Last Name',
      'Company',
      'Role',
      'Email',
      'Status',
      'Subject',
      'Body',
      'Added At'
    ];

    const rows = queue.map(contact => [
      contact.firstName || '',
      contact.lastName || '',
      contact.company || '',
      contact.role || '',
      contact.selectedEmail || contact.emails?.[0]?.email || '',
      contact.status || '',
      contact.draft?.subject || '',
      contact.draft?.body?.replace(/\n/g, ' ') || '',
      new Date(contact.addedAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Mark contact as sent
   * @param {string} contactId - Contact ID
   */
  async markAsSent(contactId) {
    await this.updateContactStatus(contactId, 'sent', {
      sentAt: Date.now()
    });
  }

  /**
   * Extract subject from draft text
   */
  extractSubject(draft) {
    const lines = draft.split('\n');
    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith('subject:')) {
        return line.replace(/^subject:\s*/i, '').trim();
      }
    }
    return 'Connecting on LinkedIn';
  }

  /**
   * Extract body from draft text
   */
  extractBody(draft) {
    const lines = draft.split('\n');
    const bodyLines = [];
    let foundSubject = false;

    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith('subject:')) {
        foundSubject = true;
        continue;
      }
      if (foundSubject || !line.trim().toLowerCase().startsWith('subject:')) {
        bodyLines.push(line);
      }
    }

    return bodyLines.join('\n').trim();
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const contactQueue = new ContactQueue();
