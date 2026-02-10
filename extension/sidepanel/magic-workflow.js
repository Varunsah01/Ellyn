// Magic Workflow - DEPRECATED
// This module has been permanently disabled as part of the system refactor.
// All logic has been moved to WorkflowOrchestrator and ConfidenceEngine.

class MagicWorkflow {
  constructor() {
    this.draftHistory = [];
    this.historyIndex = -1;
  }

  /**
   * @deprecated Use WorkflowOrchestrator.run() instead
   */
  async execute() {
    console.warn('[MagicWorkflow] CRITICAL: Attempted to run disabled legacy workflow.');
    return { success: false, error: 'Legacy workflow disabled' };
  }

  // Stubs to prevent runtime crashes if UI buttons are clicked before full cleanup
  undo() { return null; }
  redo() { return null; }
  updateDraft() {}
}

// Export singleton instance for backward compatibility until full removal
const magicWorkflow = new MagicWorkflow();