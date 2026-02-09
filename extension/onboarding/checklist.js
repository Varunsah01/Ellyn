// Onboarding Checklist Tracker
// Tracks user progress through first-time setup

class OnboardingChecklist {
  constructor() {
    this.checklistId = 'onboarding-checklist';
    this.items = [
      {
        id: 'install',
        label: 'Install Ellyn extension',
        completed: true, // Always true since they have it installed
        autoCheck: true
      },
      {
        id: 'linkedin',
        label: 'Visit a LinkedIn profile',
        completed: false,
        trigger: 'onLinkedInVisit'
      },
      {
        id: 'extract',
        label: 'Extract contact data',
        completed: false,
        trigger: 'onExtract'
      },
      {
        id: 'generate',
        label: 'Generate email draft',
        completed: false,
        trigger: 'onGenerate'
      },
      {
        id: 'send',
        label: 'Send your first email',
        completed: false,
        trigger: 'onSend'
      }
    ];

    this.isVisible = false;
    this.container = null;
  }

  /**
   * Load progress from storage
   */
  async loadProgress() {
    const result = await chrome.storage.local.get(['checklistProgress']);
    if (result.checklistProgress) {
      result.checklistProgress.forEach((completed, index) => {
        if (this.items[index]) {
          this.items[index].completed = completed;
        }
      });
    }
  }

  /**
   * Save progress to storage
   */
  async saveProgress() {
    const progress = this.items.map(item => item.completed);
    await chrome.storage.local.set({ checklistProgress: progress });
  }

  /**
   * Check if checklist should be shown
   */
  async shouldShow() {
    await this.loadProgress();

    // Show if not all completed
    const allCompleted = this.items.every(item => item.completed);
    return !allCompleted;
  }

  /**
   * Show checklist
   */
  async show() {
    const shouldShow = await this.shouldShow();
    if (!shouldShow) {
      console.log('[Checklist] All items completed');
      return;
    }

    this.isVisible = true;
    this.render();
  }

  /**
   * Hide checklist
   */
  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.isVisible = false;
  }

  /**
   * Render checklist UI
   */
  render() {
    // Remove existing
    if (this.container) {
      this.container.remove();
    }

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'onboarding-checklist';
    this.container.id = this.checklistId;

    const completedCount = this.items.filter(item => item.completed).length;
    const totalCount = this.items.length;
    const progressPercent = (completedCount / totalCount) * 100;

    this.container.innerHTML = `
      <div class="checklist-header">
        <h3>Getting Started</h3>
        <button class="checklist-close" id="checklist-close">×</button>
      </div>

      <div class="checklist-items">
        ${this.items.map(item => this.renderItem(item)).join('')}
      </div>

      <div class="checklist-footer">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <span class="progress-text">${completedCount} of ${totalCount} complete</span>
      </div>
    `;

    // Add to page
    const recentSection = document.querySelector('.recent-section');
    if (recentSection) {
      recentSection.insertAdjacentElement('beforebegin', this.container);
    } else {
      document.querySelector('.container').appendChild(this.container);
    }

    // Event listener
    const closeBtn = this.container.querySelector('#checklist-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  /**
   * Render checklist item
   */
  renderItem(item) {
    return `
      <label class="checklist-item ${item.completed ? 'completed' : ''}">
        <input
          type="checkbox"
          ${item.completed ? 'checked' : ''}
          ${item.autoCheck ? 'disabled' : ''}
          data-item-id="${item.id}"
        />
        <span class="checklist-label">${item.label}</span>
        ${item.completed ? '<span class="check-icon">✓</span>' : ''}
      </label>
    `;
  }

  /**
   * Mark item as complete
   */
  async complete(itemId, showCelebration = true) {
    const item = this.items.find(i => i.id === itemId);
    if (!item || item.completed) return;

    item.completed = true;
    await this.saveProgress();

    // Update UI if visible
    if (this.isVisible) {
      this.render();
    }

    // Show celebration
    if (showCelebration) {
      this.showCelebration(item);
    }

    // Check if all complete
    const allCompleted = this.items.every(item => item.completed);
    if (allCompleted) {
      this.showCompletionCelebration();
    }
  }

  /**
   * Show celebration for completing an item
   */
  showCelebration(item) {
    const toast = document.createElement('div');
    toast.className = 'checklist-celebration';
    toast.innerHTML = `
      <div class="celebration-icon">✓</div>
      <div class="celebration-message">
        <strong>Nice work!</strong>
        <span>${item.label} ✓</span>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /**
   * Show completion celebration
   */
  showCompletionCelebration() {
    setTimeout(() => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content completion-modal">
          <div class="completion-icon">🎉</div>
          <h2>You're a Pro!</h2>
          <p>You've completed the onboarding checklist. You're ready to crush your LinkedIn outreach!</p>

          <div class="completion-stats">
            <div class="stat">
              <div class="stat-number">${this.items.length}</div>
              <div class="stat-label">Steps Completed</div>
            </div>
            <div class="stat">
              <div class="stat-number">100%</div>
              <div class="stat-label">Progress</div>
            </div>
          </div>

          <button class="primary-btn completion-btn" id="completion-done">
            Awesome, let's go!
          </button>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('#completion-done').addEventListener('click', () => {
        modal.remove();
        this.hide();
      });

      modal.querySelector('.modal-overlay').addEventListener('click', () => {
        modal.remove();
        this.hide();
      });
    }, 500);
  }

  /**
   * Trigger handlers (called from main app)
   */
  async onLinkedInVisit() {
    await this.complete('linkedin');
  }

  async onExtract() {
    await this.complete('extract');
  }

  async onGenerate() {
    await this.complete('generate');
  }

  async onSend() {
    await this.complete('send');
  }

  /**
   * Reset checklist (for testing)
   */
  async reset() {
    this.items.forEach((item, index) => {
      if (index === 0) {
        item.completed = true; // Keep "install" checked
      } else {
        item.completed = false;
      }
    });

    await this.saveProgress();
    this.render();
  }

  /**
   * Get completion percentage
   */
  getProgress() {
    const completed = this.items.filter(item => item.completed).length;
    const total = this.items.length;
    return Math.round((completed / total) * 100);
  }
}

// Export singleton instance
const onboardingChecklist = new OnboardingChecklist();
