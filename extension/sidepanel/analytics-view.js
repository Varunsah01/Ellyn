// Analytics View
// Renders the analytics dashboard UI

class AnalyticsView {
  constructor() {
    this.container = null;
    this.refreshInterval = null;
  }

  /**
   * Render analytics view
   */
  async render() {
    const summary = await analyticsTracker.getSummary();
    const insights = await analyticsInsights.generateInsights();
    const achievements = await analyticsInsights.getAchievements();
    const weeklyReport = await analyticsInsights.getWeeklyReport();

    const container = document.getElementById('analytics-view-container');
    if (!container) {
      console.error('[Analytics] Container not found');
      return;
    }

    this.container = container;

    container.innerHTML = `
      <div class="analytics-view">
        <!-- Header -->
        <div class="analytics-header">
          <div class="analytics-title">
            <h2>📊 Your Outreach Stats</h2>
            <p class="analytics-subtitle">Track performance and improve over time</p>
          </div>
          <div class="analytics-actions">
            <button id="export-analytics-btn" class="icon-btn" title="Export to CSV">
              📥 Export
            </button>
            <button id="refresh-analytics-btn" class="icon-btn" title="Refresh">
              ↻ Refresh
            </button>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          ${this.renderStatCard('📧', summary.totalSent, 'Emails Sent', `+${weeklyReport.thisWeek.sent} this week`, weeklyReport.change.sent)}
          ${this.renderStatCard('💬', summary.totalResponses, 'Responses', `${summary.responseRate}% response rate`, weeklyReport.change.responses)}
          ${this.renderStatCard('🤝', summary.referrals, 'Referrals Offered', `${this.calculateConversionRate(summary)}% conversion`, null)}
          ${this.renderStatCard('✨', `$${summary.totalAICost}`, 'Total AI Cost', `Avg $${summary.avgCostPerEmail}/email`, null)}
        </div>

        <!-- Weekly Comparison -->
        <div class="weekly-comparison">
          <h3>Week Over Week</h3>
          <div class="week-stats">
            <div class="week-column">
              <div class="week-label">This Week</div>
              <div class="week-value">${weeklyReport.thisWeek.sent}</div>
              <div class="week-detail">${weeklyReport.thisWeek.rate}% response</div>
            </div>
            <div class="week-arrow">
              ${weeklyReport.change.sent > 0 ? '↗️' : weeklyReport.change.sent < 0 ? '↘️' : '→'}
            </div>
            <div class="week-column">
              <div class="week-label">Last Week</div>
              <div class="week-value">${weeklyReport.lastWeek.sent}</div>
              <div class="week-detail">${weeklyReport.lastWeek.rate}% response</div>
            </div>
          </div>
        </div>

        <!-- Insights -->
        <div class="insights-section">
          <h3>💡 Insights & Suggestions</h3>
          ${insights.length > 0 ? `
            <div class="insights-list">
              ${insights.map(insight => this.renderInsight(insight)).join('')}
            </div>
          ` : `
            <div class="no-insights">
              <p>Send more emails to unlock personalized insights!</p>
            </div>
          `}
        </div>

        <!-- Achievements -->
        ${achievements.length > 0 ? `
          <div class="achievements-section">
            <h3>🏆 Achievements</h3>
            <div class="achievements-grid">
              ${achievements.slice(0, 6).map(achievement => this.renderAchievement(achievement)).join('')}
            </div>
            ${achievements.length > 6 ? `
              <button id="view-all-achievements-btn" class="secondary-btn small">
                View All ${achievements.length} Achievements
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- Recent Activity -->
        <div class="recent-activity">
          <h3>Recent Activity</h3>
          ${summary.recentEmails.length > 0 ? `
            <div class="activity-list">
              ${summary.recentEmails.map(email => this.renderActivityItem(email)).join('')}
            </div>
          ` : `
            <div class="no-activity">
              <p>No emails sent yet. Start reaching out!</p>
            </div>
          `}
        </div>

        <!-- Response Tracker Prompt -->
        ${this.renderResponseTrackerPrompt(summary)}
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render stat card
   */
  renderStatCard(icon, value, label, change, changeValue) {
    const isPositive = changeValue > 0;
    const isNegative = changeValue < 0;
    const changeClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

    return `
      <div class="stat-card">
        <div class="stat-icon">${icon}</div>
        <div class="stat-content">
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
          <div class="stat-change ${changeClass}">
            ${change}
            ${changeValue !== null ? `
              <span class="change-indicator">
                ${isPositive ? '↑' : isNegative ? '↓' : ''}
                ${Math.abs(changeValue)}
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render insight item
   */
  renderInsight(insight) {
    const typeClass = `insight-${insight.type}`; // info, warning, success
    return `
      <div class="insight-item ${typeClass}">
        <div class="insight-icon">${insight.icon}</div>
        <div class="insight-content">
          <p class="insight-message">${insight.message}</p>
          ${insight.action ? `
            <button class="insight-action" data-link="${insight.actionLink || '#'}">
              ${insight.action} →
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render achievement badge
   */
  renderAchievement(achievement) {
    return `
      <div class="achievement-badge">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.desc}</div>
      </div>
    `;
  }

  /**
   * Render activity item
   */
  renderActivityItem(email) {
    const statusIcon = email.status === 'responded' ? '✅' : '📤';
    const statusText = email.status === 'responded'
      ? `Responded (${email.responseType})`
      : 'Sent';

    const timeAgo = this.getTimeAgo(email.sentAt);

    return `
      <div class="activity-item" data-email-id="${email.id}">
        <div class="activity-status">${statusIcon}</div>
        <div class="activity-details">
          <div class="activity-contact">${email.contactName} at ${email.company}</div>
          <div class="activity-meta">
            <span>${statusText}</span>
            <span>•</span>
            <span>${timeAgo}</span>
            ${email.status === 'sent' ? `
              <button class="mark-response-btn" data-email-id="${email.id}">
                Mark Response
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render response tracker prompt
   */
  renderResponseTrackerPrompt(summary) {
    const unreplied = summary.recentEmails.filter(e => e.status === 'sent');

    if (unreplied.length === 0) return '';

    return `
      <div class="response-tracker-prompt">
        <div class="prompt-header">
          <h3>📬 Track Responses</h3>
          <p>Did any of these contacts respond?</p>
        </div>
        <div class="unreplied-list">
          ${unreplied.slice(0, 3).map(email => `
            <div class="unreplied-item">
              <span>${email.contactName}</span>
              <button class="mark-response-btn primary" data-email-id="${email.id}">
                Mark Response
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Calculate conversion rate (referrals / responses)
   */
  calculateConversionRate(summary) {
    if (summary.totalResponses === 0) return 0;
    return ((summary.referrals / summary.totalResponses) * 100).toFixed(1);
  }

  /**
   * Get time ago string
   */
  getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Export button
    const exportBtn = document.getElementById('export-analytics-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAnalytics());
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-analytics-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.render());
    }

    // Mark response buttons
    const markButtons = document.querySelectorAll('.mark-response-btn');
    markButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emailId = e.target.getAttribute('data-email-id');
        this.showResponseModal(emailId);
      });
    });

    // Insight actions
    const insightActions = document.querySelectorAll('.insight-action');
    insightActions.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const link = e.target.getAttribute('data-link');
        this.handleInsightAction(link);
      });
    });

    // View all achievements
    const viewAchievementsBtn = document.getElementById('view-all-achievements-btn');
    if (viewAchievementsBtn) {
      viewAchievementsBtn.addEventListener('click', () => this.showAllAchievements());
    }
  }

  /**
   * Export analytics to CSV
   */
  async exportAnalytics() {
    try {
      const csv = await analyticsTracker.exportToCSV();
      const filename = `ellyn-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      analyticsTracker.downloadCSV(csv, filename);

      // Show success toast
      this.showToast('✓ Analytics exported successfully');
    } catch (error) {
      console.error('[Analytics] Export error:', error);
      this.showToast('✗ Failed to export analytics', 'error');
    }
  }

  /**
   * Show response tracking modal
   */
  showResponseModal(emailId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'response-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Track Response</h3>
          <button class="modal-close" id="response-modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Did this contact respond to your email?</p>

          <div class="response-options">
            <button class="response-option positive" data-type="positive">
              <span class="option-icon">✅</span>
              <span class="option-label">Positive Response</span>
              <span class="option-desc">Interested in chatting</span>
            </button>

            <button class="response-option referral" data-type="referral">
              <span class="option-icon">🎉</span>
              <span class="option-label">Offered Referral</span>
              <span class="option-desc">Will refer you!</span>
            </button>

            <button class="response-option negative" data-type="negative">
              <span class="option-icon">❌</span>
              <span class="option-label">Declined</span>
              <span class="option-desc">Not interested</span>
            </button>

            <button class="response-option noresponse" data-type="noresponse">
              <span class="option-icon">📭</span>
              <span class="option-label">No Response</span>
              <span class="option-desc">Haven't heard back</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('#response-modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    const options = modal.querySelectorAll('.response-option');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    options.forEach(option => {
      option.addEventListener('click', async (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        await this.markResponse(emailId, type);
        closeModal();
      });
    });
  }

  /**
   * Mark response
   */
  async markResponse(emailId, responseType) {
    try {
      await analyticsTracker.markResponse(emailId, responseType);

      // Show success
      this.showToast('✓ Response tracked successfully');

      // Refresh view
      await this.render();

      // Update onboarding if first response
      if (typeof trackOnboardingProgress === 'function') {
        await trackOnboardingProgress('response');
      }
    } catch (error) {
      console.error('[Analytics] Error marking response:', error);
      this.showToast('✗ Failed to track response', 'error');
    }
  }

  /**
   * Handle insight action click
   */
  handleInsightAction(link) {
    if (link.startsWith('#')) {
      // Internal link - scroll to section or show modal
      console.log('[Analytics] Navigate to:', link);
      // TODO: Implement navigation to help sections
      this.showToast('Coming soon: ' + link);
    } else {
      // External link
      window.open(link, '_blank');
    }
  }

  /**
   * Show all achievements modal
   */
  async showAllAchievements() {
    const achievements = await analyticsInsights.getAchievements();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content achievements-modal">
        <div class="modal-header">
          <h3>🏆 All Achievements</h3>
          <button class="modal-close" id="achievements-modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="achievements-grid-modal">
            ${achievements.map(achievement => this.renderAchievement(achievement)).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#achievements-modal-close');
    const overlay = modal.querySelector('.modal-overlay');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Show analytics view
   */
  show() {
    const container = document.getElementById('analytics-view-container');
    if (container) {
      container.style.display = 'block';
      this.render();
    }
  }

  /**
   * Hide analytics view
   */
  hide() {
    const container = document.getElementById('analytics-view-container');
    if (container) {
      container.style.display = 'none';
    }
  }
}

// Export singleton instance
const analyticsView = new AnalyticsView();
