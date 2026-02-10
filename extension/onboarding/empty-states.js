// Empty States Component
// Provides helpful guidance when no content is available

class EmptyStates {
  /**
   * Show empty queue state
   */
  static renderEmptyQueue() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>No contacts in queue</h3>
        <p>Extract LinkedIn profiles and add them to your queue for batch processing</p>
        <div class="empty-actions">
          <button class="primary-btn" onclick="window.open('https://linkedin.com/search/people', '_blank')">
            🔍 Find People on LinkedIn
          </button>
          <button class="secondary-btn" onclick="onboardingTour.showSampleTutorial()">
            ✨ Try with Sample Data
          </button>
        </div>
        <div class="empty-hint">
          💡 Tip: Visit a LinkedIn profile and click "Extract & Generate Draft"
        </div>
      </div>
    `;
  }

  /**
   * Show empty drafts state
   */
  static renderEmptyDrafts() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No drafts ready</h3>
        <p>Add contacts to your queue and generate drafts to see them here</p>
        <div class="empty-actions">
          <button class="primary-btn" onclick="document.getElementById('drafts-view-container').style.display='none'; document.getElementById('queue-view-container').style.display='block';">
            ← Back to Queue
          </button>
          <button class="secondary-btn" onclick="onboardingTour.showSampleTutorial()">
            ✨ Try Sample Workflow
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show not on LinkedIn state
   */
  static renderNotOnLinkedIn() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔗</div>
        <h3>Visit a LinkedIn Profile</h3>
        <p>To extract contact data, navigate to any LinkedIn profile page</p>
        <div class="empty-actions">
          <button class="primary-btn" onclick="window.open('https://linkedin.com/search/people', '_blank')">
            Open LinkedIn
          </button>
          <button class="secondary-btn" onclick="toggleManualSection()">
            Enter Details Manually
          </button>
        </div>
        <div class="empty-example">
          <strong>Example URL:</strong>
          <code>linkedin.com/in/john-doe</code>
        </div>
      </div>
    `;
  }

  /**
   * Show no API key state
   */
  static renderNoAPIKey() {
    return `
      <div class="empty-state warning">
        <div class="empty-icon">✨</div>
        <h3>AI Generation Not Set Up</h3>
        <p>Add your Anthropic API key to unlock AI-powered personalized drafts</p>
        <div class="empty-cost">
          <span class="cost-badge">~$0.05 for 50 emails</span>
        </div>
        <div class="empty-actions">
          <button class="primary-btn" onclick="EmptyStates.openAPISettings()">
            Set Up AI Key
          </button>
          <button class="secondary-btn" onclick="alert('Templates will be used automatically when AI is unavailable')">
            Use Templates Instead
          </button>
        </div>
        <div class="empty-hint">
          💡 Get your API key at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>
        </div>
      </div>
    `;
  }

  /**
   * Show no recent contacts state
   */
  static renderNoRecentContacts() {
    return `
      <div class="empty-state-mini">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          No recent contacts yet
        </p>
      </div>
    `;
  }

  /**
   * Show first-time welcome state
   */
  static renderWelcome() {
    return `
      <div class="welcome-state">
        <div class="welcome-header">
          <div class="welcome-logo">✨</div>
          <h2>Welcome to Ellyn!</h2>
          <p>Your AI-powered LinkedIn outreach assistant</p>
        </div>

        <div class="welcome-features">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Extract Contacts</h3>
            <p>One-click extraction from LinkedIn profiles</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <h3>AI Drafts</h3>
            <p>Personalized emails generated in seconds</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📧</div>
            <h3>Batch Send</h3>
            <p>Queue & send multiple emails at once</p>
          </div>
        </div>

        <div class="welcome-actions">
          <button class="primary-btn" id="start-tour-btn">
            🚀 Take the Tour (30 seconds)
          </button>
          <button class="secondary-btn" id="skip-tour-btn">
            Skip & Explore
          </button>
        </div>

        <div class="welcome-footer">
          <a href="https://github.com/yourusername/ellyn" target="_blank">Learn more</a>
        </div>
      </div>
    `;
  }

  /**
   * Show contextual help based on current state
   */
  static showContextualHelp(context) {
    let helpMessage = null;

    if (context.isLinkedIn && !context.hasExtracted) {
      helpMessage = {
        icon: '👆',
        text: 'Click "Extract & Generate Draft" to get started',
        action: () => document.getElementById('magic-extract-btn')?.scrollIntoView({ behavior: 'smooth' })
      };
    } else if (context.hasExtracted && !context.hasGenerated) {
      helpMessage = {
        icon: '✨',
        text: 'Try "Generate with AI" for a personalized draft',
        action: null
      };
    } else if (context.hasDraft && !context.hasSent) {
      helpMessage = {
        icon: '📧',
        text: 'Review your draft, then click "Send via Gmail"',
        action: null
      };
    } else if (context.sentCount === 1) {
      helpMessage = {
        icon: '🎉',
        text: 'First email sent! You\'re on your way.',
        action: null,
        celebration: true
      };
    }

    if (helpMessage) {
      this.displayHelpTooltip(helpMessage);
    }
  }

  /**
   * Display help tooltip
   */
  static displayHelpTooltip(help) {
    // Remove existing
    const existing = document.getElementById('contextual-help');
    if (existing) existing.remove();

    const tooltip = document.createElement('div');
    tooltip.id = 'contextual-help';
    tooltip.className = `contextual-help ${help.celebration ? 'celebration' : ''}`;
    tooltip.innerHTML = `
      <span class="help-icon">${help.icon}</span>
      <span class="help-text">${help.text}</span>
      <button class="help-close">×</button>
    `;

    document.body.appendChild(tooltip);

    // Auto-show
    setTimeout(() => tooltip.classList.add('show'), 100);

    // Auto-hide after 5 seconds (unless celebration)
    if (!help.celebration) {
      setTimeout(() => {
        tooltip.classList.remove('show');
        setTimeout(() => tooltip.remove(), 300);
      }, 5000);
    }

    // Close button
    tooltip.querySelector('.help-close').addEventListener('click', () => {
      tooltip.classList.remove('show');
      setTimeout(() => tooltip.remove(), 300);
    });

    // Action (if provided)
    if (help.action) {
      tooltip.style.cursor = 'pointer';
      tooltip.addEventListener('click', () => {
        help.action();
        tooltip.remove();
      });
    }
  }

  /**
   * Open API settings
   */
  static openAPISettings() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Set Up AI Generation</h3>
          <button class="modal-close" id="api-close">×</button>
        </div>
        <div class="modal-body">
          <p>To use AI-powered draft generation, you'll need an Anthropic API key.</p>

          <div class="api-steps">
            <div class="api-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <strong>Get your API key</strong>
                <p>Visit <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a> and create a key</p>
              </div>
            </div>

            <div class="api-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <strong>Enter your key below</strong>
                <input type="password" id="api-key-input" placeholder="sk-ant-..." />
              </div>
            </div>

            <div class="api-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <strong>Start generating!</strong>
                <p>Each draft costs ~$0.001 (about $1 per 1000 emails)</p>
              </div>
            </div>
          </div>

          <div class="api-note">
            🔒 Your API key is stored locally and never shared
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="api-cancel">Cancel</button>
          <button class="primary-btn" id="api-save">Save API Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#api-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('#api-cancel').addEventListener('click', () => modal.remove());

    modal.querySelector('#api-save').addEventListener('click', async () => {
      const apiKey = modal.querySelector('#api-key-input').value.trim();

      if (!apiKey) {
        alert('Please enter your API key');
        return;
      }

      if (!apiKey.startsWith('sk-ant-')) {
        alert('Invalid API key format. Anthropic keys start with "sk-ant-"');
        return;
      }

      // Save to storage
      await chrome.storage.local.set({ anthropicApiKey: apiKey });

      modal.remove();

      // Show success
      const toast = document.createElement('div');
      toast.className = 'toast-notification show';
      toast.textContent = '✓ API key saved! AI generation is now enabled.';
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    });
  }

  /**
   * Detect current context
   */
  static async detectContext() {
    const stats = await chrome.storage.local.get([
      'hasExtracted',
      'hasGenerated',
      'hasSent',
      'sentCount'
    ]);

    // Check if on LinkedIn
    const isLinkedIn = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getActiveTab' }, (response) => {
        const url = response?.url || '';
        const eligibility = window.EllynPageDetector.detectEligibility(url);
        resolve(eligibility.eligible);
      });
    });

    return {
      isLinkedIn,
      hasExtracted: stats.hasExtracted || false,
      hasGenerated: stats.hasGenerated || false,
      hasSent: stats.hasSent || false,
      sentCount: stats.sentCount || 0
    };
  }
}

// Export
window.EmptyStates = EmptyStates;
