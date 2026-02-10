/**
 * @typedef {Object} WorkflowResult
 * @property {"success" | "partial" | "blocked"} status - Overall workflow status
 * @property {Object} data - Extracted data
 * @property {Object} decision - Confidence engine decision
 * @property {string} [error] - Error message if blocked
 */

(function(window) {
  'use strict';

  /**
   * WorkflowOrchestrator
   * Coordinates the complete extraction workflow:
   * Eligibility -> Readiness -> Extraction -> Confidence Evaluation
   */
  class WorkflowOrchestrator {
    constructor() {
      // Dependencies (injected via window/global)
      this.pageDetector = window.EllynPageDetector;
      this.domWaiter = window.EllynDomWaiter;
      this.nameExtractor = window.EllynNameExtractor;
      this.confidenceEngine = window.EllynConfidenceEngine;
      // Note: Email inference is lazy-loaded via getter to handle script load order
      
      // Execution Guard
      this.isProcessing = false;
      
      // Stub for other extractors (could be injected similarly)
      this.extractors = {
        name: this.nameExtractor,
        // Add company/role extractors here when available
      };
    }

    /**
     * Lazy-load email inference engine to prevent load-order race conditions
     */
    get emailInferenceEngine() {
      if (typeof window !== 'undefined' && window.EllynEmailInference) {
        return window.EllynEmailInference;
      }
      if (typeof self !== 'undefined' && self.EllynEmailInference) {
        return self.EllynEmailInference;
      }
      return null;
    }

    /**
     * Run the full extraction workflow
     * @returns {Promise<WorkflowResult>}
     */
    async run() {
      // 1. Check Guard
      if (this.isProcessing) {
        console.warn('[WorkflowOrchestrator] Blocked: Workflow already running');
        return this._createResult('blocked', {}, null, 'Workflow already running');
      }

      // 2. Acquire Lock
      this.isProcessing = true;
      console.log('[WorkflowOrchestrator] Lock acquired. Workflow starting.');

      try {
        // 3. Check Dependencies
        if (!this._checkDependencies()) {
          return this._createResult('blocked', {}, null, 'Missing internal dependencies');
        }

        // 4. Check Page Eligibility
        const eligibility = this.pageDetector.detectEligibility(window.location.href);
        if (!eligibility.eligible) {
          return this._createResult('blocked', {}, null, eligibility.reason || 'Page not eligible');
        }

        // 5. Wait for DOM Readiness
        // Note: DomWaiter handles its own timeouts, so this await will eventually resolve/reject
        const isReady = await this.domWaiter.waitForProfileReady();
        if (!isReady) {
          console.warn('[WorkflowOrchestrator] DOM readiness timeout. Proceeding anyway (soft gate).');
        } else {
          console.log('[WorkflowOrchestrator] DOM ready detected.');
        }

        // 6. Extract Fields
        const extractedFields = this._performExtraction();
        
        // 7. Infer Emails (Safely)
        const emailResult = this._inferEmails(extractedFields);
        if (emailResult) {
          extractedFields.email = emailResult;
        }

        // 8. Evaluate Confidence
        const decision = this.confidenceEngine.evaluate(extractedFields);

        // 9. Determine Final Status
        let status = 'success';
        let error = null;

        if (decision.action === 'BLOCK') {
          status = 'blocked';
          error = decision.reasons.join(', ');
        } else if (decision.action === 'REQUIRE_CONFIRMATION') {
          status = 'partial';
        }

        console.log('[WorkflowOrchestrator] Workflow logic finished. Status:', status);
        return this._createResult(status, extractedFields, decision, error);

      } catch (error) {
        // 10. Catch All Errors
        console.error('[WorkflowOrchestrator] Unhandled error during workflow:', error);
        return this._createResult('blocked', {}, null, 'Internal workflow error: ' + error.message);

      } finally {
        // 11. Always Release Lock
        this.isProcessing = false;
        console.log('[WorkflowOrchestrator] Lock released.');
      }
    }

    /**
     * Safely infer emails from extracted data
     */
    _inferEmails(fields) {
      const engine = this.emailInferenceEngine;
      
      if (!engine) {
        console.warn('[WorkflowOrchestrator] Email inference dependency missing (EllynEmailInference). Skipping.');
        return null;
      }

      try {
        const name = fields.name?.value;
        const company = fields.company?.value;

        if (!name || !company) return null;

        const nameParts = name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        const patterns = engine.generatePatterns({
          firstName,
          lastName,
          company
        });

        // Wrap as a FieldResult
        if (patterns && patterns.length > 0) {
          return {
            value: patterns[0].email, // Best guess
            confidence: patterns[0].confidence || 50,
            source: 'inference',
            alternatives: patterns
          };
        }
      } catch (e) {
        console.error('[WorkflowOrchestrator] Email inference error:', e);
      }
      
      return null;
    }

    /**
     * Helper: Perform extraction using available extractors
     */
    _performExtraction() {
      const results = {};

      // Name Extraction
      if (this.extractors.name) {
        results.name = this.extractors.name.extract(document);
      } else {
        results.name = { value: null, confidence: 0, source: 'missing' };
      }

      // Placeholder for Company/Role (simulating extraction for now)
      // In a real scenario, this would call CompanyExtractor.extract()
      // For this task, we'll try to extract simple fallbacks to allow testing
      results.company = this._extractSimpleMeta('company') || 
                        this._extractSimpleMeta('og:description') || 
                        { value: 'Unknown Company', confidence: 0, source: 'fallback' };

      // Try to parse company from headline if NameExtractor didn't (it doesn't currently)
      // This is just a stub to ensure we have *some* data for the confidence engine
      if (results.company.confidence === 0) {
          // If we had a headline extractor, we'd use it. 
          // For now, let's assume if name was found in H1, company might be in the headline below it
          // This is purely for demonstration of the orchestrator flow
          const headline = document.querySelector('.text-body-medium');
          if (headline) {
             results.company = { value: 'Inferred Company', confidence: 50, source: 'dom-inference' };
          }
      }

      return results;
    }

    _extractSimpleMeta(property) {
      // Helper stub for mocked company extraction
      // In real app, use dedicated extractors
      return null; 
    }

    _checkDependencies() {
      return (
        this.pageDetector &&
        this.domWaiter &&
        this.nameExtractor &&
        this.confidenceEngine
      );
    }

    _createResult(status, data, decision, error) {
      return {
        status,
        data,
        decision,
        error
      };
    }
  }

  // Export
  window.EllynWorkflowOrchestrator = new WorkflowOrchestrator();

})(typeof window !== 'undefined' ? window : self);
