/**
 * API Configuration for AI Email Generation
 *
 * Uses Claude 3.5 Haiku for cost-effective email generation
 * Includes rate limiting and cost controls
 */

const API_CONFIG = {
  anthropic: {
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022', // Cost-effective model
    maxTokens: 300, // Keep responses concise
    temperature: 0.7,
    apiVersion: '2023-06-01'
  },

  // Cost controls
  costPerRequest: 0.001, // Approximate cost in USD
  dailyLimit: 50, // Max generations per day per user
  rateLimitWindow: 60000, // 1 minute in milliseconds
  rateLimitMax: 3, // Max 3 requests per minute

  // Warnings and thresholds
  warnThreshold: 10, // Warn when 10 remaining
  modelUpgradeThreshold: 20, // Suggest upgrade at 20+ uses

  // Pricing (per million tokens)
  pricing: {
    inputCost: 0.25,
    outputCost: 1.25
  }
};

// Export for both browser extension and module contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
} else {
  window.API_CONFIG = API_CONFIG;
}
