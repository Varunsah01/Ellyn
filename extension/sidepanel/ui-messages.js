/**
 * UI Message Definitions
 * Centralized mapping of workflow states to user-facing messages.
 */
const UIMessages = {
  extraction: {
    success: '✓ Contact extracted successfully',
    partial: '⚠️ Some details need verification. Please review.',
    blocked: 'Workflow blocked: ',
    error: 'Extraction failed: '
  },
  save: {
    success: '✓ Contact saved successfully',
    error: 'Failed to save contact: '
  },
  sync: {
    success: '✓ Synced with web app',
    error: 'Sync failed: '
  },
  queue: {
    added: '✓ Added to queue',
    removed: 'Contact removed from queue',
    cleared: 'Queue cleared',
    empty: 'No pending contacts to generate drafts for',
    notFound: 'Contact not found',
    generationStart: 'Generating drafts...',
    generationSuccess: '✓ Drafts generated successfully',
    generationError: 'Draft generation failed: '
  },
  validation: {
    missingEmail: 'Please select an email pattern first'
  },
  
  /**
   * Get formatted message for workflow result
   * @param {Object} result - WorkflowOrchestrator result
   * @returns {string}
   */
  getWorkflowMessage(result) {
    if (result.status === 'success') return this.extraction.success;
    if (result.status === 'partial') return this.extraction.partial;
    if (result.status === 'blocked') return this.extraction.blocked + (result.error || 'Unknown reason');
    return this.extraction.error;
  }
};

window.UIMessages = UIMessages;
