// Analytics Tracker
// Tracks email sends, responses, and performance metrics

class AnalyticsTracker {
  /**
   * Initialize tracker
   */
  constructor() {
    this.storageKey = 'emailHistory';
    this.statsKey = 'analyticsStats';
  }

  /**
   * Generate unique ID for tracking entries
   */
  generateId() {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track email sent
   */
  async trackEmailSent(contact, draft, method = 'gmail') {
    try {
      const tracking = {
        id: this.generateId(),

        // Contact info
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`,
        company: contact.company,
        role: contact.role,
        email: contact.selectedEmail,

        // Email content
        subject: draft.subject,
        bodyLength: draft.body ? draft.body.length : 0,
        wordCount: draft.body ? draft.body.split(/\s+/).length : 0,

        // Template/AI info
        template: draft.templateUsed || 'Custom',
        isAI: draft.generatedByAI || false,
        aiModel: draft.aiModel || null,
        aiCost: draft.aiCost || 0,

        // Send method
        method: method, // 'gmail', 'outlook', 'clipboard'

        // Timestamps
        sentAt: Date.now(),
        sentDate: new Date().toISOString(),
        dayOfWeek: new Date().getDay(), // 0=Sunday, 1=Monday, etc.
        hourOfDay: new Date().getHours(),

        // Response tracking
        status: 'sent',
        opened: null,
        replied: null,
        responseType: null, // 'positive', 'negative', 'referral'
        respondedAt: null,

        // Metadata
        personalizationScore: draft.personalizationScore || 0,
        hasIcebreaker: draft.hasIcebreaker || false,
        subjectLineScore: draft.subjectLineScore || 0
      };

      // Save to history
      await this.saveToHistory(tracking);

      // Update counters
      await this.incrementCounter('totalSent');
      await this.incrementCounter(`sent_${method}`);
      if (tracking.isAI) {
        await this.incrementCounter('aiGenerated');
        await this.addToCost(tracking.aiCost);
      }

      // Track daily/weekly stats
      await this.updateTimeBasedStats(tracking);

      console.log('[Analytics] Email tracked:', tracking.id);
      return tracking;
    } catch (error) {
      console.error('[Analytics] Error tracking email:', error);
      return null;
    }
  }

  /**
   * Mark response received
   */
  async markResponse(emailId, responseType, notes = '') {
    try {
      const history = await this.getHistory();
      const email = history.find(e => e.id === emailId);

      if (!email) {
        console.warn('[Analytics] Email not found:', emailId);
        return false;
      }

      // Update email
      email.status = 'responded';
      email.responseType = responseType; // 'positive', 'negative', 'referral', 'noresponse'
      email.respondedAt = Date.now();
      email.responseNotes = notes;
      email.timeToResponse = email.respondedAt - email.sentAt; // milliseconds

      // Save updated history
      await this.saveHistory(history);

      // Update counters
      await this.incrementCounter('totalResponses');
      await this.incrementCounter(`response_${responseType}`);

      console.log('[Analytics] Response tracked:', emailId, responseType);
      return true;
    } catch (error) {
      console.error('[Analytics] Error marking response:', error);
      return false;
    }
  }

  /**
   * Save to email history
   */
  async saveToHistory(tracking) {
    const history = await this.getHistory();
    history.unshift(tracking); // Add to beginning

    // Keep last 500 emails to avoid storage bloat
    if (history.length > 500) {
      history.splice(500);
    }

    await chrome.storage.local.set({ [this.storageKey]: history });
  }

  /**
   * Get email history
   */
  async getHistory(limit = null) {
    const result = await chrome.storage.local.get([this.storageKey]);
    const history = result[this.storageKey] || [];
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Save entire history (for updates)
   */
  async saveHistory(history) {
    await chrome.storage.local.set({ [this.storageKey]: history });
  }

  /**
   * Get analytics stats
   */
  async getStats() {
    const result = await chrome.storage.local.get([this.statsKey]);
    return result[this.statsKey] || {
      totalSent: 0,
      totalResponses: 0,
      aiGenerated: 0,
      totalAICost: 0,
      sent_gmail: 0,
      sent_outlook: 0,
      sent_clipboard: 0,
      response_positive: 0,
      response_negative: 0,
      response_referral: 0,
      response_noresponse: 0,
      dailyStats: {},
      weeklyStats: {}
    };
  }

  /**
   * Save analytics stats
   */
  async saveStats(stats) {
    await chrome.storage.local.set({ [this.statsKey]: stats });
  }

  /**
   * Increment counter
   */
  async incrementCounter(key, amount = 1) {
    const stats = await this.getStats();
    stats[key] = (stats[key] || 0) + amount;
    await this.saveStats(stats);
  }

  /**
   * Add to total AI cost
   */
  async addToCost(cost) {
    const stats = await this.getStats();
    stats.totalAICost = (stats.totalAICost || 0) + cost;
    await this.saveStats(stats);
  }

  /**
   * Update time-based stats
   */
  async updateTimeBasedStats(tracking) {
    const stats = await this.getStats();

    // Daily stats
    const dateKey = new Date(tracking.sentAt).toISOString().split('T')[0]; // YYYY-MM-DD
    if (!stats.dailyStats) stats.dailyStats = {};
    if (!stats.dailyStats[dateKey]) {
      stats.dailyStats[dateKey] = { sent: 0, responses: 0 };
    }
    stats.dailyStats[dateKey].sent++;

    // Weekly stats (ISO week)
    const weekKey = this.getISOWeek(new Date(tracking.sentAt));
    if (!stats.weeklyStats) stats.weeklyStats = {};
    if (!stats.weeklyStats[weekKey]) {
      stats.weeklyStats[weekKey] = { sent: 0, responses: 0 };
    }
    stats.weeklyStats[weekKey].sent++;

    await this.saveStats(stats);
  }

  /**
   * Get ISO week number
   */
  getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
  }

  /**
   * Calculate response rate
   */
  async calculateResponseRate() {
    const stats = await this.getStats();
    if (stats.totalSent === 0) return 0;
    return ((stats.totalResponses / stats.totalSent) * 100).toFixed(1);
  }

  /**
   * Calculate average word count
   */
  async calculateAvgWordCount() {
    const history = await this.getHistory();
    if (history.length === 0) return 0;
    const total = history.reduce((sum, email) => sum + (email.wordCount || 0), 0);
    return Math.round(total / history.length);
  }

  /**
   * Get this week's stats
   */
  async getThisWeekStats() {
    const history = await this.getHistory();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const thisWeek = history.filter(e => e.sentAt >= oneWeekAgo);
    const responded = thisWeek.filter(e => e.status === 'responded');

    return {
      sent: thisWeek.length,
      responses: responded.length,
      responseRate: thisWeek.length > 0 ? ((responded.length / thisWeek.length) * 100).toFixed(1) : 0
    };
  }

  /**
   * Get template performance
   */
  async getTemplatePerformance() {
    const history = await this.getHistory();
    const templates = {};

    history.forEach(email => {
      const template = email.template || 'Custom';
      if (!templates[template]) {
        templates[template] = { sent: 0, responses: 0, rate: 0 };
      }
      templates[template].sent++;
      if (email.status === 'responded') {
        templates[template].responses++;
      }
    });

    // Calculate rates
    Object.keys(templates).forEach(key => {
      if (templates[key].sent > 0) {
        templates[key].rate = ((templates[key].responses / templates[key].sent) * 100).toFixed(1);
      }
    });

    return templates;
  }

  /**
   * Get best send times
   */
  async getBestSendTimes() {
    const history = await this.getHistory().then(h =>
      h.filter(e => e.status === 'responded')
    );

    if (history.length === 0) return null;

    // Analyze by day of week
    const dayStats = {};
    const hourStats = {};

    history.forEach(email => {
      // Day of week
      const day = email.dayOfWeek;
      if (!dayStats[day]) dayStats[day] = 0;
      dayStats[day]++;

      // Hour of day
      const hour = email.hourOfDay;
      if (!hourStats[hour]) hourStats[hour] = 0;
      hourStats[hour]++;
    });

    // Find best day
    const bestDay = Object.keys(dayStats).reduce((a, b) =>
      dayStats[a] > dayStats[b] ? a : b
    );

    // Find best hour
    const bestHour = Object.keys(hourStats).reduce((a, b) =>
      hourStats[a] > hourStats[b] ? a : b
    );

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      bestDay: dayNames[bestDay],
      bestHour: parseInt(bestHour),
      bestHourFormatted: this.formatHour(parseInt(bestHour))
    };
  }

  /**
   * Format hour (24h to 12h)
   */
  formatHour(hour) {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  }

  /**
   * Export to CSV
   */
  async exportToCSV() {
    const history = await this.getHistory();

    const headers = [
      'Date',
      'Contact Name',
      'Company',
      'Role',
      'Email',
      'Subject',
      'Word Count',
      'Template',
      'AI Generated',
      'Send Method',
      'Status',
      'Response Type',
      'Time to Response (hours)',
      'Day of Week',
      'Hour Sent'
    ];

    const rows = history.map(email => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const timeToResponse = email.timeToResponse
        ? (email.timeToResponse / (1000 * 60 * 60)).toFixed(1) // Convert ms to hours
        : 'N/A';

      return [
        new Date(email.sentAt).toLocaleDateString(),
        email.contactName,
        email.company,
        email.role,
        email.email,
        `"${email.subject}"`, // Quoted to handle commas
        email.wordCount,
        email.template,
        email.isAI ? 'Yes' : 'No',
        email.method,
        email.status,
        email.responseType || 'N/A',
        timeToResponse,
        dayNames[email.dayOfWeek],
        this.formatHour(email.hourOfDay)
      ];
    });

    // Build CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Download CSV file
   */
  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all analytics data (for testing)
   */
  async clearAllData() {
    await chrome.storage.local.remove([this.storageKey, this.statsKey]);
    console.log('[Analytics] All data cleared');
  }

  /**
   * Get summary stats
   */
  async getSummary() {
    const stats = await this.getStats();
    const history = await this.getHistory();
    const responseRate = await this.calculateResponseRate();
    const avgWordCount = await this.calculateAvgWordCount();
    const thisWeek = await this.getThisWeekStats();

    return {
      totalSent: stats.totalSent || 0,
      totalResponses: stats.totalResponses || 0,
      responseRate: parseFloat(responseRate),
      referrals: stats.response_referral || 0,
      totalAICost: (stats.totalAICost || 0).toFixed(2),
      avgCostPerEmail: stats.totalSent > 0
        ? ((stats.totalAICost || 0) / stats.totalSent).toFixed(3)
        : '0.000',
      avgWordCount,
      thisWeek,
      recentEmails: history.slice(0, 10)
    };
  }
}

// Export singleton instance
const analyticsTracker = new AnalyticsTracker();
