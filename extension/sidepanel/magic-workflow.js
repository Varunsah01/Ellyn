// Magic Workflow - Streamlined 3-click flow
// Handles: Extract → Infer → Detect → Generate → Send

class MagicWorkflow {
  constructor() {
    this.currentContact = null;
    this.selectedEmail = null;
    this.selectedTemplate = null;
    this.generatedDraft = null;
    this.draftHistory = [];
    this.historyIndex = -1;
  }

  /**
   * Main magic workflow - runs entire pipeline
   * @param {string} linkedinUrl - Current LinkedIn URL
   * @returns {Promise<Object>} - Final draft result
   */
  async execute(linkedinUrl) {
    const steps = [
      { text: 'Extracting profile...', fn: () => this.extractProfile() },
      { text: 'Finding best email...', fn: () => this.inferEmail() },
      { text: 'Detecting role type...', fn: () => this.detectRole() },
      { text: 'Generating personalized draft...', fn: () => this.generateDraft() },
      { text: 'Draft ready!', fn: () => this.finalize() }
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        this.updateProgress(i + 1, steps.length, steps[i].text);
        await steps[i].fn();
        await this.sleep(300); // Smooth transition between steps
      }

      this.showSuccess();
      return {
        success: true,
        contact: this.currentContact,
        email: this.selectedEmail,
        template: this.selectedTemplate,
        draft: this.generatedDraft
      };
    } catch (error) {
      this.showError(error.message);
      throw error;
    }
  }

  /**
   * Step 1: Extract LinkedIn profile with rich context
   */
  async extractProfile() {
    const result = await this.sendMessage({ action: 'extractProfile' });

    if (!result || !result.success) {
      throw new Error(result?.error || 'Profile extraction failed');
    }

    // Basic extraction
    this.currentContact = {
      firstName: result.data.firstName,
      lastName: result.data.lastName,
      company: result.data.company,
      role: result.data.role,
      headline: result.data.headline,
      location: result.data.location,
      profileUrl: result.data.profileUrl
    };

    // Extract rich context
    try {
      const richContext = contextExtractor.extractRichContext();
      Object.assign(this.currentContact, richContext);
      console.log('[Magic] Rich context extracted:', richContext);
    } catch (error) {
      console.warn('[Magic] Rich context extraction failed:', error);
      // Continue without rich context
    }

    return this.currentContact;
  }

  /**
   * Step 2: Infer best email pattern
   */
  async inferEmail() {
    // Generate email patterns locally
    let emails = emailInference.generatePatterns({
      firstName: this.currentContact.firstName,
      lastName: this.currentContact.lastName,
      company: this.currentContact.company
    });

    // Try API enrichment for better results
    try {
      const apiResult = await apiClient.enrichContact({
        firstName: this.currentContact.firstName,
        lastName: this.currentContact.lastName,
        company: this.currentContact.company,
        role: this.currentContact.role
      });

      if (apiResult.success && apiResult.emails && apiResult.emails.length > 0) {
        // Merge API emails with local patterns
        emails = [...apiResult.emails, ...emails];

        // Store enrichment data
        this.currentContact.enrichment = apiResult.enrichment || {};
      }
    } catch (error) {
      console.log('[Magic] API enrichment unavailable, using local patterns');
    }

    // Deduplicate and sort by confidence
    const seen = new Set();
    const unique = [];
    for (const e of emails) {
      if (!seen.has(e.email)) {
        seen.add(e.email);
        unique.push(e);
      }
    }

    emails = unique.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    this.currentContact.emails = emails;

    // Auto-select highest confidence email
    this.selectedEmail = this.autoSelectBestEmail(emails);

    return this.selectedEmail;
  }

  /**
   * Step 3: Detect role type and recommend template
   */
  async detectRole() {
    const detection = roleDetector.detectRecruiterRole(
      this.currentContact.role || '',
      this.currentContact.company || ''
    );

    this.currentContact.isRecruiter = detection.isRecruiter;
    this.currentContact.isBigTech = detection.isBigTech;
    this.currentContact.roleConfidence = detection.confidence;

    // Auto-select best template
    this.selectedTemplate = detection.recommendedTemplate;

    return detection;
  }

  /**
   * Step 4: Generate personalized draft with rich context
   */
  async generateDraft() {
    const userProfile = await storage.getUserProfile();

    // Try AI generation with enriched prompt
    try {
      const enrichedPrompt = contextExtractor.buildEnrichedPrompt(
        this.currentContact,
        userProfile
      );

      const aiResult = await apiClient.enrichContact({
        firstName: this.currentContact.firstName,
        lastName: this.currentContact.lastName,
        company: this.currentContact.company,
        role: this.currentContact.role,
        generateDraft: true,
        email: this.selectedEmail,
        customPrompt: enrichedPrompt
      });

      if (aiResult.draft) {
        this.generatedDraft = {
          subject: this.extractSubject(aiResult.draft),
          body: this.extractBody(aiResult.draft),
          source: 'ai-enriched',
          icebreaker: this.extractIcebreaker(aiResult.draft)
        };

        // Save to history
        this.saveDraftState(this.generatedDraft);
        return this.generatedDraft;
      }
    } catch (error) {
      console.log('[Magic] AI draft unavailable, using enhanced template');
    }

    // Fallback to enhanced template-based generation
    const template = recruiterTemplates.generateTemplate(
      this.selectedTemplate,
      this.currentContact,
      userProfile
    );

    // Generate personalized icebreaker
    const icebreaker = icebreakerGenerator.generateIcebreaker(
      this.currentContact,
      userProfile
    );

    // Enhance body with icebreaker
    let enhancedBody = template.body;
    if (icebreaker && icebreaker.text) {
      enhancedBody = icebreaker.text + '\n\n' + template.body;
    }

    // Enhance with company insights
    const insights = companyInsights.getInsights(this.currentContact.company);
    if (insights && insights.focus && insights.focus.length > 0) {
      // Subtle mention of company focus
      enhancedBody = enhancedBody.replace(
        this.currentContact.company,
        `${this.currentContact.company} (especially your work in ${insights.focus[0].toLowerCase()})`
      );
    }

    // Generate personalized subject line
    const subjectLines = subjectLineGenerator.generateSubjectLines(
      this.currentContact,
      userProfile,
      this.selectedTemplate
    );

    const bestSubject = subjectLines.length > 0
      ? subjectLines[0].text
      : template.subject;

    this.generatedDraft = {
      subject: bestSubject,
      body: enhancedBody,
      source: 'template-enriched',
      icebreaker: icebreaker,
      alternateSubjects: subjectLines.slice(1, 4),
      companyInsights: insights
    };

    // Save to history
    this.saveDraftState(this.generatedDraft);

    return this.generatedDraft;
  }

  /**
   * Extract icebreaker from draft
   */
  extractIcebreaker(draft) {
    const body = this.extractBody(draft);
    const firstLine = body.split('\n\n')[0];
    return firstLine && firstLine.length < 100 ? firstLine : null;
  }

  /**
   * Step 5: Finalize and prepare for sending
   */
  async finalize() {
    // Calculate word count
    const wordCount = this.generatedDraft.body.split(/\s+/).length;
    const charCount = this.generatedDraft.body.length;

    this.generatedDraft.wordCount = wordCount;
    this.generatedDraft.charCount = charCount;

    return this.generatedDraft;
  }

  /**
   * Auto-select best email from patterns
   */
  autoSelectBestEmail(emails) {
    if (!emails || emails.length === 0) {
      throw new Error('No email patterns found');
    }

    // Sort by confidence and return highest
    const sorted = [...emails].sort((a, b) => b.confidence - a.confidence);
    return sorted[0].email;
  }

  /**
   * Extract subject line from draft
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
   * Extract body from draft (remove subject line)
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
   * Update progress UI
   */
  updateProgress(current, total, message) {
    const percent = (current / total) * 100;
    const progressBar = document.getElementById('magic-progress-bar');
    const progressText = document.getElementById('magic-progress-text');
    const progressStep = document.getElementById('magic-progress-step');

    if (progressBar) {
      progressBar.style.width = percent + '%';
    }

    if (progressText) {
      progressText.textContent = message;
    }

    if (progressStep) {
      progressStep.textContent = `Step ${current} of ${total}`;
    }
  }

  /**
   * Show success state
   */
  showSuccess() {
    const progressContainer = document.getElementById('magic-progress-container');
    const resultsContainer = document.getElementById('magic-results-container');

    if (progressContainer) {
      progressContainer.style.display = 'none';
    }

    if (resultsContainer) {
      resultsContainer.style.display = 'block';
    }

    // Play success animation
    this.playSuccessAnimation();
  }

  /**
   * Show error state
   */
  showError(message) {
    const progressContainer = document.getElementById('magic-progress-container');
    const progressText = document.getElementById('magic-progress-text');

    if (progressText) {
      progressText.textContent = `Error: ${message}`;
      progressText.style.color = '#ef4444';
    }

    setTimeout(() => {
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    }, 3000);
  }

  /**
   * Play success animation
   */
  playSuccessAnimation() {
    const toast = document.createElement('div');
    toast.className = 'magic-success-toast';
    toast.innerHTML = `
      <div class="success-icon">✓</div>
      <div class="success-message">
        <strong>Draft ready!</strong>
        <span>Your personalized message is ready to send</span>
      </div>
    `;

    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Fade out and remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Draft history management
   */
  saveDraftState(draft) {
    this.draftHistory = this.draftHistory.slice(0, this.historyIndex + 1);
    this.draftHistory.push({
      ...draft,
      timestamp: Date.now()
    });
    this.historyIndex++;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.generatedDraft = { ...this.draftHistory[this.historyIndex] };
      return this.generatedDraft;
    }
    return null;
  }

  redo() {
    if (this.historyIndex < this.draftHistory.length - 1) {
      this.historyIndex++;
      this.generatedDraft = { ...this.draftHistory[this.historyIndex] };
      return this.generatedDraft;
    }
    return null;
  }

  /**
   * Update draft content
   */
  updateDraft(subject, body) {
    this.generatedDraft.subject = subject;
    this.generatedDraft.body = body;
    this.generatedDraft.wordCount = body.split(/\s+/).length;
    this.generatedDraft.charCount = body.length;

    this.saveDraftState(this.generatedDraft);
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: send message to background
   */
  sendMessage(message) {
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
}

// Export singleton instance
const magicWorkflow = new MagicWorkflow();
