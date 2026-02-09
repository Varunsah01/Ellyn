// Interactive Onboarding Tour
// Guides new users through first-time setup

class OnboardingTour {
  constructor() {
    this.currentStep = 0;
    this.isActive = false;
    this.overlay = null;
    this.tooltip = null;

    // Tour steps
    this.steps = [
      {
        target: '#magic-extract-btn',
        title: 'Welcome to Ellyn! 👋',
        message: 'Click here to extract contact info from any LinkedIn profile in seconds',
        position: 'bottom',
        action: 'pulse',
        delay: 500
      },
      {
        target: '#queue-view-container',
        title: 'Contact Queue 📋',
        message: 'Add multiple contacts to your queue for batch processing',
        position: 'top',
        action: 'highlight',
        delay: 0
      },
      {
        target: '#view-drafts-btn',
        title: 'Drafts View 📧',
        message: 'Review and manage all your generated email drafts in one place',
        position: 'bottom',
        action: 'highlight',
        delay: 0
      },
      {
        target: '.magic-keyboard-hint',
        title: 'Keyboard Shortcuts ⌨️',
        message: 'Use Ctrl+Enter to send, Ctrl+E to edit, and Ctrl+/ for all shortcuts',
        position: 'top',
        action: 'highlight',
        delay: 0
      },
      {
        target: '#manual-section',
        title: 'Manual Entry 📝',
        message: 'Not on LinkedIn? You can also enter contact details manually',
        position: 'top',
        action: 'scroll',
        delay: 0
      }
    ];
  }

  /**
   * Check if user has seen tour
   */
  async hasSeenTour() {
    const result = await chrome.storage.local.get(['hasSeenTour']);
    return result.hasSeenTour || false;
  }

  /**
   * Start the tour
   */
  async start() {
    // Check if already seen
    const seen = await this.hasSeenTour();
    if (seen) {
      console.log('[Tour] User has already seen tour');
      return false;
    }

    this.isActive = true;
    this.currentStep = 0;
    this.showStep(this.steps[0]);
    return true;
  }

  /**
   * Restart tour (for manual trigger)
   */
  restart() {
    this.isActive = true;
    this.currentStep = 0;
    this.showStep(this.steps[0]);
  }

  /**
   * Show a specific step
   */
  showStep(step) {
    // Remove previous elements
    this.cleanup();

    // Wait for delay
    setTimeout(() => {
      // Create overlay
      this.overlay = this.createOverlay();
      document.body.appendChild(this.overlay);

      // Highlight target element
      const target = document.querySelector(step.target);
      if (!target) {
        console.warn(`[Tour] Target not found: ${step.target}`);
        this.next();
        return;
      }

      // Scroll to target
      if (step.action === 'scroll') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Apply action
      this.applyAction(target, step.action);

      // Create tooltip
      this.tooltip = this.createTooltip(step, target);
      document.body.appendChild(this.tooltip);

      // Position tooltip
      this.positionTooltip(this.tooltip, target, step.position);

    }, step.delay);
  }

  /**
   * Create overlay
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.id = 'tour-overlay';
    return overlay;
  }

  /**
   * Create tooltip
   */
  createTooltip(step, target) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.id = 'tour-tooltip';

    const stepNumber = this.currentStep + 1;
    const totalSteps = this.steps.length;

    tooltip.innerHTML = `
      <div class="tour-tooltip-header">
        <h3>${step.title}</h3>
        <button class="tour-close" id="tour-close">×</button>
      </div>
      <div class="tour-tooltip-body">
        <p>${step.message}</p>
      </div>
      <div class="tour-tooltip-footer">
        <span class="tour-progress">${stepNumber} of ${totalSteps}</span>
        <div class="tour-buttons">
          ${this.currentStep > 0 ? '<button class="tour-btn tour-btn-back" id="tour-back">Back</button>' : ''}
          <button class="tour-btn tour-btn-skip" id="tour-skip">Skip Tour</button>
          <button class="tour-btn tour-btn-next" id="tour-next">
            ${this.currentStep < this.steps.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    `;

    // Event listeners
    tooltip.querySelector('#tour-next').addEventListener('click', () => this.next());
    tooltip.querySelector('#tour-skip').addEventListener('click', () => this.skip());
    tooltip.querySelector('#tour-close').addEventListener('click', () => this.skip());

    const backBtn = tooltip.querySelector('#tour-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.back());
    }

    return tooltip;
  }

  /**
   * Position tooltip relative to target
   */
  positionTooltip(tooltip, target, position) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left - tooltipRect.width - 20;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + 20;
        break;
      default:
        top = targetRect.bottom + 20;
        left = targetRect.left;
    }

    // Keep tooltip on screen
    const padding = 10;
    const maxTop = window.innerHeight - tooltipRect.height - padding;
    const maxLeft = window.innerWidth - tooltipRect.width - padding;

    top = Math.max(padding, Math.min(top, maxTop));
    left = Math.max(padding, Math.min(left, maxLeft));

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }

  /**
   * Apply visual action to target
   */
  applyAction(target, action) {
    // Add spotlight
    target.classList.add('tour-spotlight');

    // Add specific action
    if (action === 'pulse') {
      target.classList.add('tour-pulse');
    } else if (action === 'highlight') {
      target.classList.add('tour-highlight');
    }

    // Remove after animation
    setTimeout(() => {
      if (action === 'pulse') {
        target.classList.remove('tour-pulse');
      }
    }, 2000);
  }

  /**
   * Go to next step
   */
  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.showStep(this.steps[this.currentStep]);
    } else {
      this.complete();
    }
  }

  /**
   * Go to previous step
   */
  back() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.showStep(this.steps[this.currentStep]);
    }
  }

  /**
   * Skip tour
   */
  skip() {
    this.complete();
  }

  /**
   * Complete tour
   */
  async complete() {
    this.cleanup();
    this.isActive = false;

    // Mark as seen
    await chrome.storage.local.set({ hasSeenTour: true });

    // Show success message
    this.showSuccessMessage();

    // Start checklist
    if (typeof onboardingChecklist !== 'undefined') {
      onboardingChecklist.show();
    }
  }

  /**
   * Cleanup tour elements
   */
  cleanup() {
    // Remove overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Remove tooltip
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    // Remove all spotlights and effects
    document.querySelectorAll('.tour-spotlight').forEach(el => {
      el.classList.remove('tour-spotlight', 'tour-pulse', 'tour-highlight');
    });
  }

  /**
   * Show success message
   */
  showSuccessMessage() {
    const toast = document.createElement('div');
    toast.className = 'tour-success-toast';
    toast.innerHTML = `
      <div class="success-icon">🎉</div>
      <div class="success-message">
        <strong>You're all set!</strong>
        <span>Let's find your first contact on LinkedIn</span>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Show sample data tutorial
   */
  async showSampleTutorial() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sample-tutorial-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Try Ellyn with Sample Data</h3>
          <button class="modal-close" id="sample-close">×</button>
        </div>
        <div class="modal-body">
          <p>Not on LinkedIn? No problem! Try the full workflow with this sample contact:</p>

          <div class="sample-contact-card">
            <div class="contact-avatar">SJ</div>
            <div class="contact-details">
              <div class="contact-name">Sarah Johnson</div>
              <div class="contact-role">Senior Recruiter</div>
              <div class="contact-company">Google</div>
            </div>
          </div>

          <p class="sample-note">This will demonstrate the complete workflow without visiting LinkedIn.</p>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="sample-cancel">Cancel</button>
          <button class="primary-btn" id="sample-start">✨ Try Sample Workflow</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#sample-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('#sample-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#sample-start').addEventListener('click', () => {
      modal.remove();
      this.runSampleWorkflow();
    });
  }

  /**
   * Run sample workflow with fake data
   */
  async runSampleWorkflow() {
    const sampleContact = {
      id: 'sample-' + Date.now(),
      firstName: 'Sarah',
      lastName: 'Johnson',
      company: 'Google',
      role: 'Senior Technical Recruiter',
      headline: 'Technical Recruiter at Google | Hiring for AI/ML teams',
      location: 'San Francisco, CA',
      profileUrl: 'https://linkedin.com/in/sample',
      school: 'Stanford University',
      mutualConnections: 3,
      emails: [
        { email: 'sarah.johnson@google.com', pattern: 'firstlast@company.com', confidence: 95 },
        { email: 's.johnson@google.com', pattern: 'f.last@company.com', confidence: 85 }
      ],
      selectedEmail: 'sarah.johnson@google.com',
      recentPosts: [
        { snippet: 'Hiring for Google AI team - exciting opportunities!', type: 'post' }
      ],
      skills: ['Recruiting', 'Talent Acquisition', 'Technical Hiring']
    };

    // Show toast
    const toast = document.createElement('div');
    toast.className = 'toast-notification show';
    toast.textContent = 'Running sample workflow...';
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);

    // Simulate adding to queue
    if (typeof contactQueue !== 'undefined') {
      // Generate draft
      const draft = await contactQueue.generateDraftForContact(sampleContact);
      sampleContact.draft = draft;
      sampleContact.status = 'ready';

      await contactQueue.addToQueue(sampleContact);

      // Show drafts view
      setTimeout(() => {
        if (typeof openDraftsView !== 'undefined') {
          openDraftsView();
        }

        // Show success
        const successToast = document.createElement('div');
        successToast.className = 'toast-notification show';
        successToast.textContent = '✓ Sample draft generated! Review it in the Drafts View.';
        document.body.appendChild(successToast);

        setTimeout(() => successToast.remove(), 3000);
      }, 1000);
    }
  }
}

// Export singleton instance
const onboardingTour = new OnboardingTour();
