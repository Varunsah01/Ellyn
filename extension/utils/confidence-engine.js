/**
 * @typedef {Object} FieldResult
 * @property {string|null} value - The extracted value
 * @property {number} confidence - Confidence score (0-100)
 * @property {string} source - Source of extraction
 */

/**
 * @typedef {Object} EvaluationDecision
 * @property {"AUTO_CONTINUE" | "REQUIRE_CONFIRMATION" | "BLOCK"} action - Recommended action
 * @property {string[]} missingFields - Fields that failed validation
 * @property {string[]} lowConfidenceFields - Fields below auto-continue threshold
 * @property {string[]} reasons - Human-readable reasons
 */

(function(window) {
  'use strict';

  /**
   * ConfidenceEngine
   * Evaluates the quality of extracted data to guide workflow decisions.
   */
  class ConfidenceEngine {
    constructor(config = {}) {
      this.config = {
        requiredFields: ['name', 'company'], // Fields that MUST be present
        
        // Thresholds for "Auto Continue" (High Confidence)
        autoContinueThresholds: {
          name: 80,
          role: 60,
          company: 70,
          default: 70
        },

        // Thresholds for "Block" (Data unusable)
        blockThresholds: {
          name: 10, // If name confidence is < 10, it's garbage
          default: 0
        },
        
        ...config
      };
    }

    /**
     * Evaluate a set of extracted fields
     * @param {Object.<string, FieldResult>} fields - Map of field names to results
     * @returns {EvaluationDecision}
     */
    evaluate(fields) {
      const decision = {
        action: 'AUTO_CONTINUE',
        missingFields: [],
        lowConfidenceFields: [],
        reasons: []
      };

      // 1. Check Required Fields
      for (const field of this.config.requiredFields) {
        if (!fields[field] || !fields[field].value) {
          decision.missingFields.push(field);
          decision.reasons.push(`Missing required field: ${field}`);
        }
      }

      if (decision.missingFields.length > 0) {
        decision.action = 'BLOCK';
        return decision;
      }

      // 2. Evaluate Confidence Scores
      for (const [fieldName, result] of Object.entries(fields)) {
        const score = result.confidence || 0;
        
        // Check Blocking Thresholds
        const blockThresh = this.config.blockThresholds[fieldName] || this.config.blockThresholds.default;
        if (score < blockThresh) {
          decision.action = 'BLOCK';
          decision.reasons.push(`Critical confidence failure for ${fieldName} (${score} < ${blockThresh})`);
          return decision; // Immediate fail
        }

        // Check Auto-Continue Thresholds
        const autoThresh = this.config.autoContinueThresholds[fieldName] || this.config.autoContinueThresholds.default;
        if (score < autoThresh) {
          decision.lowConfidenceFields.push(fieldName);
          decision.reasons.push(`Low confidence for ${fieldName} (${score} < ${autoThresh})`);
        }
      }

      // 3. Determine Final Action
      if (decision.lowConfidenceFields.length > 0) {
        decision.action = 'REQUIRE_CONFIRMATION';
      }

      return decision;
    }
  }

  // Export
  window.EllynConfidenceEngine = new ConfidenceEngine();

})(typeof window !== 'undefined' ? window : self);
