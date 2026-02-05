/**
 * AI Draft Generation Integration for Ellyn Sidebar
 *
 * Handles all AI generation UI interactions, including:
 * - API key setup
 * - User profile management
 * - Draft generation with Claude API
 * - Error handling and fallbacks
 * - Cost tracking and limits
 */

// Global state
let aiGenerator = null;
let currentDraft = null;
let userProfile = null;

// ========================================
// Initialization
// ========================================

async function initializeAIGeneration() {
  console.log('[AI Generation] Initializing...');

  // Create generator instance
  aiGenerator = new window.AIDraftGenerator();

  // Load user profile
  await loadUserProfile();

  // Check API key status
  const hasKey = await aiGenerator.hasApiKey();
  console.log('[AI Generation] API key configured:', hasKey);

  // Update UI based on API key status
  await updateAIGenerationUI();

  // Setup event listeners
  setupAIEventListeners();

  // Load usage stats
  await updateUsageDisplay();

  console.log('[AI Generation] ✓ Initialization complete');
}

// ========================================
// Event Listeners
// ========================================

function setupAIEventListeners() {
  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', showAPIConfigModal);

  // Generate AI draft button
  document.getElementById('generate-ai-draft-btn')?.addEventListener('click', handleGenerateAIDraft);

  // Use template button
  document.getElementById('use-template-btn')?.addEventListener('click', showTemplateSection);

  // Regenerate button
  document.getElementById('regenerate-btn')?.addEventListener('click', handleRegenerateDraft);

  // API config modal
  document.getElementById('close-modal-btn')?.addEventListener('click', hideAPIConfigModal);
  document.getElementById('cancel-api-key-btn')?.addEventListener('click', hideAPIConfigModal);
  document.getElementById('save-api-key-btn')?.addEventListener('click', handleSaveAPIKey);
  document.getElementById('remove-api-key-btn')?.addEventListener('click', handleRemoveAPIKey);
  document.getElementById('toggle-api-key-visibility')?.addEventListener('click', toggleAPIKeyVisibility);

  // User profile modal
  document.getElementById('close-profile-modal-btn')?.addEventListener('click', hideUserProfileModal);
  document.getElementById('cancel-profile-btn')?.addEventListener('click', hideUserProfileModal);
  document.getElementById('save-profile-btn')?.addEventListener('click', handleSaveUserProfile);

  // Draft editing
  document.getElementById('draft-body')?.addEventListener('input', updateWordCount);
  document.getElementById('draft-subject')?.addEventListener('input', () => {
    // Mark draft as edited
    if (currentDraft) {
      currentDraft.edited = true;
    }
  });

  // Modal overlay clicks
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      hideAPIConfigModal();
      hideUserProfileModal();
    });
  });
}

// ========================================
// AI Draft Generation
// ========================================

async function handleGenerateAIDraft() {
  console.log('[AI Generation] Generate button clicked');

  // Validate prerequisites
  if (!currentContact) {
    showToast('Please extract a contact first', 'error');
    return;
  }

  if (!selectedEmail) {
    showToast('Please select an email address first', 'error');
    return;
  }

  // Check if API key is configured
  const hasKey = await aiGenerator.hasApiKey();
  if (!hasKey) {
    showToast('API key not configured', 'error');
    showAPIConfigModal();
    return;
  }

  // Check if user profile is set
  if (!userProfile || !userProfile.name) {
    showToast('Please set up your profile first', 'error');
    showUserProfileModal();
    return;
  }

  // Show loading state
  showLoadingOverlay('Generating personalized draft with AI...');

  try {
    // Get generation parameters
    const style = document.getElementById('draft-style')?.value || 'professional';
    const tone = document.getElementById('draft-tone')?.value || 'warm';
    const customInstructions = document.getElementById('custom-instructions')?.value || '';

    // Generate draft
    const result = await aiGenerator.generateDraft({
      contact: {
        name: currentContact.fullName,
        role: currentContact.currentRole,
        company: currentContact.companyName
      },
      userProfile: userProfile,
      style: style,
      tone: tone,
      customInstructions: customInstructions,
      purpose: 'referral'
    });

    if (result.success) {
      // Store draft
      currentDraft = {
        ...result.draft,
        cost: result.cost,
        usage: result.usage,
        timestamp: new Date().toISOString(),
        edited: false
      };

      // Display draft
      displayGeneratedDraft(currentDraft);

      // Show success message
      showToast(`✓ Draft generated! Cost: $${result.cost.toFixed(4)}`, 'success');

      // Update usage display
      await updateUsageDisplay();

      // Hide AI section, show draft section
      document.getElementById('ai-draft-section')?.classList.add('hidden');
      document.getElementById('draft-preview-section')?.classList.remove('hidden');
      document.getElementById('actions-section')?.classList.remove('hidden');

      console.log('[AI Generation] ✓ Draft generated successfully');

    } else {
      throw new Error(result.error || 'Generation failed');
    }

  } catch (error) {
    console.error('[AI Generation] Error:', error);
    handleGenerationError(error);

  } finally {
    hideLoadingOverlay();
  }
}

async function handleRegenerateDraft() {
  if (!confirm('Regenerate draft? This will use another AI generation and may incur additional cost (~$0.001).')) {
    return;
  }

  // Clear current draft
  currentDraft = null;

  // Show AI section again
  document.getElementById('draft-preview-section')?.classList.add('hidden');
  document.getElementById('ai-draft-section')?.classList.remove('hidden');

  // Trigger generation
  await handleGenerateAIDraft();
}

function displayGeneratedDraft(draft) {
  const subjectInput = document.getElementById('draft-subject');
  const bodyTextarea = document.getElementById('draft-body');
  const costSpan = document.getElementById('draft-cost');

  if (subjectInput) subjectInput.value = draft.subject || '';
  if (bodyTextarea) bodyTextarea.value = draft.body || '';
  if (costSpan) costSpan.textContent = `Cost: $${(draft.cost || 0).toFixed(4)}`;

  updateWordCount();
}

function updateWordCount() {
  const bodyTextarea = document.getElementById('draft-body');
  const wordCountSpan = document.getElementById('word-count');

  if (!bodyTextarea || !wordCountSpan) return;

  const text = bodyTextarea.value || '';
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;

  wordCountSpan.textContent = `${wordCount} words`;

  // Warn if too long
  if (wordCount > 200) {
    wordCountSpan.style.color = '#f59e0b';
  } else {
    wordCountSpan.style.color = '';
  }
}

// ========================================
// Error Handling
// ========================================

function handleGenerationError(error) {
  const message = error.message || 'Unknown error';

  if (message.includes('Rate limit')) {
    showToast('⏱️ Please wait a moment before generating another email', 'error', 5000);
  } else if (message.includes('Daily generation limit')) {
    showToast('📊 Daily limit reached (50 emails). Resets at midnight!', 'error', 7000);
  } else if (message.includes('API key')) {
    showToast('🔑 API key issue. Please check your settings', 'error');
    setTimeout(() => showAPIConfigModal(), 1000);
  } else if (message.includes('Network error')) {
    showToast('🌐 Network error. Check your connection and try again', 'error');
  } else if (message.includes('Invalid API key')) {
    showToast('❌ Invalid API key. Please update your settings', 'error', 7000);
    setTimeout(() => showAPIConfigModal(), 1000);
  } else {
    showToast(`❌ Generation failed: ${message}`, 'error', 5000);
  }

  // Offer template fallback
  setTimeout(() => offerTemplateFallback(), 2000);
}

function offerTemplateFallback() {
  const useTemplate = confirm(
    'AI generation failed. Would you like to use a template instead?'
  );

  if (useTemplate) {
    showTemplateSection();
  }
}

function showTemplateSection() {
  // Hide AI sections
  document.getElementById('ai-draft-section')?.classList.add('hidden');
  document.getElementById('draft-preview-section')?.classList.add('hidden');

  // Show template section
  document.getElementById('template-section')?.classList.remove('hidden');

  showToast('Switched to template mode', 'info');
}

// ========================================
// API Key Management
// ========================================

function showAPIConfigModal() {
  const modal = document.getElementById('api-config-modal');
  const input = document.getElementById('api-key-input');
  const removeBtn = document.getElementById('remove-api-key-btn');

  if (!modal) return;

  modal.classList.remove('hidden');

  // Check if API key exists
  aiGenerator.hasApiKey().then(hasKey => {
    if (hasKey && removeBtn) {
      removeBtn.style.display = 'block';
    } else if (removeBtn) {
      removeBtn.style.display = 'none';
    }
  });

  // Clear input
  if (input) input.value = '';
}

function hideAPIConfigModal() {
  const modal = document.getElementById('api-config-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleSaveAPIKey() {
  const input = document.getElementById('api-key-input');
  if (!input) return;

  const apiKey = input.value.trim();

  if (!apiKey) {
    showToast('Please enter an API key', 'error');
    return;
  }

  if (!apiKey.startsWith('sk-ant-')) {
    showToast('Invalid API key format. Must start with "sk-ant-"', 'error');
    return;
  }

  try {
    showLoadingOverlay('Saving API key...');

    await aiGenerator.saveApiKey(apiKey);

    showToast('✓ API key saved successfully!', 'success');

    hideAPIConfigModal();

    // Update UI
    await updateAIGenerationUI();

    // Prompt for user profile if not set
    if (!userProfile || !userProfile.name) {
      setTimeout(() => {
        if (confirm('Set up your profile now? This helps personalize AI-generated emails.')) {
          showUserProfileModal();
        }
      }, 500);
    }

  } catch (error) {
    console.error('[AI Generation] Error saving API key:', error);
    showToast(`Failed to save API key: ${error.message}`, 'error');
  } finally {
    hideLoadingOverlay();
  }
}

async function handleRemoveAPIKey() {
  if (!confirm('Remove API key? You will need to add it again to use AI generation.')) {
    return;
  }

  try {
    await aiGenerator.removeApiKey();
    showToast('✓ API key removed', 'success');
    hideAPIConfigModal();
    await updateAIGenerationUI();
  } catch (error) {
    showToast(`Failed to remove API key: ${error.message}`, 'error');
  }
}

function toggleAPIKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const button = document.getElementById('toggle-api-key-visibility');

  if (!input || !button) return;

  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}

// ========================================
// User Profile Management
// ========================================

function showUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;

  // Load current profile
  if (userProfile) {
    const nameInput = document.getElementById('user-name-input');
    const roleInput = document.getElementById('user-role-input');
    const schoolInput = document.getElementById('user-school-input');

    if (nameInput) nameInput.value = userProfile.name || '';
    if (roleInput) roleInput.value = userProfile.role || '';
    if (schoolInput) schoolInput.value = userProfile.school || '';
  }

  modal.classList.remove('hidden');
}

function hideUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleSaveUserProfile() {
  const nameInput = document.getElementById('user-name-input');
  const roleInput = document.getElementById('user-role-input');
  const schoolInput = document.getElementById('user-school-input');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  const role = roleInput?.value.trim() || '';
  const school = schoolInput?.value.trim() || '';

  if (!name) {
    showToast('Please enter your name', 'error');
    return;
  }

  userProfile = { name, role, school };

  try {
    await chrome.storage.local.set({ userProfile: userProfile });
    showToast('✓ Profile saved!', 'success');
    hideUserProfileModal();
    console.log('[AI Generation] User profile saved:', userProfile);
  } catch (error) {
    showToast('Failed to save profile', 'error');
    console.error('[AI Generation] Error saving profile:', error);
  }
}

async function loadUserProfile() {
  try {
    const storage = await chrome.storage.local.get(['userProfile']);
    userProfile = storage.userProfile || null;
    console.log('[AI Generation] User profile loaded:', userProfile);
  } catch (error) {
    console.error('[AI Generation] Error loading profile:', error);
  }
}

// ========================================
// UI Updates
// ========================================

async function updateAIGenerationUI() {
  const hasKey = await aiGenerator.hasApiKey();
  const generateBtn = document.getElementById('generate-ai-draft-btn');

  if (!hasKey) {
    if (generateBtn) {
      generateBtn.textContent = '🔑 Set up AI Generation';
      generateBtn.onclick = showAPIConfigModal;
    }
  } else {
    if (generateBtn) {
      generateBtn.textContent = '✨ Generate with AI';
      generateBtn.onclick = handleGenerateAIDraft;
    }
  }
}

async function updateUsageDisplay() {
  try {
    const stats = await aiGenerator.getUsageStats();
    const remainingSpan = document.getElementById('remaining-generations');

    if (remainingSpan) {
      remainingSpan.textContent = `${stats.remaining} generations remaining today`;

      // Color coding
      if (stats.remaining <= 5) {
        remainingSpan.style.color = '#ef4444';
      } else if (stats.remaining <= 10) {
        remainingSpan.style.color = '#f59e0b';
      } else {
        remainingSpan.style.color = '';
      }
    }

    console.log('[AI Generation] Usage stats:', stats);
  } catch (error) {
    console.error('[AI Generation] Error loading usage:', error);
  }
}

// ========================================
// UI Helpers
// ========================================

function showLoadingOverlay(message = 'Loading...') {
  const overlay = document.getElementById('loading-overlay');
  const messageEl = document.getElementById('loading-message');

  if (overlay) overlay.classList.remove('hidden');
  if (messageEl) messageEl.textContent = message;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  const messageEl = document.getElementById('toast-message');

  if (!toast || !messageEl) return;

  messageEl.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// Export for use in main sidebar
window.AIGeneration = {
  initialize: initializeAIGeneration,
  showAPIConfig: showAPIConfigModal,
  showUserProfile: showUserProfileModal,
  handleGenerate: handleGenerateAIDraft,
  updateUsage: updateUsageDisplay
};

console.log('[AI Generation] Module loaded');
