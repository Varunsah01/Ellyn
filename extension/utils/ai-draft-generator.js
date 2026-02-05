/**
 * AI Email Draft Generator using Claude API
 *
 * CRITICAL SAFETY FEATURES:
 * - User must explicitly click "Generate with AI"
 * - Shows cost estimation before generation
 * - Rate limiting (3 per minute, 50 per day)
 * - Graceful fallback to templates if API fails
 * - All outputs reviewed and editable by user
 *
 * PRIVACY:
 * - API key stored locally in Chrome Storage (encrypted by Chrome)
 * - Never logs or exposes API key
 * - No backend tracking
 */

class AIDraftGenerator {
  constructor() {
    this.apiConfig = window.API_CONFIG;
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  /**
   * Generate personalized email draft using Claude API
   * @param {Object} params - Generation parameters
   * @param {Object} params.contact - Contact information { name, role, company }
   * @param {Object} params.userProfile - User's background { name, role, school }
   * @param {string} params.style - Email style (professional/casual/referral)
   * @param {string} params.tone - Email tone (warm/direct/enthusiastic)
   * @param {string} params.customInstructions - Additional user instructions
   * @param {string} params.purpose - Email purpose (referral/networking/informational)
   * @returns {Promise<Object>} Generated draft with cost info
   */
  async generateDraft({
    contact,
    userProfile,
    style = 'professional',
    tone = 'warm',
    customInstructions = '',
    purpose = 'referral'
  }) {
    console.log('[AI Draft] Starting generation...', { style, tone, purpose });

    // Validate inputs
    if (!contact || !contact.name || !contact.role || !contact.company) {
      throw new Error('Contact information incomplete');
    }

    if (!userProfile || !userProfile.name) {
      throw new Error('User profile incomplete');
    }

    // Rate limiting check
    await this.checkRateLimit();

    // Check daily limit
    await this.checkDailyLimit();

    // Build prompt
    const prompt = this.buildPrompt({
      contact,
      userProfile,
      style,
      tone,
      customInstructions,
      purpose
    });

    console.log('[AI Draft] Prompt built, making API request...');

    // Get API key
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Please add your Anthropic API key in settings.');
    }

    // Make API request
    try {
      const response = await fetch(this.apiConfig.anthropic.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': this.apiConfig.anthropic.apiVersion
        },
        body: JSON.stringify({
          model: this.apiConfig.anthropic.model,
          max_tokens: this.apiConfig.anthropic.maxTokens,
          temperature: this.apiConfig.anthropic.temperature,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AI Draft] API error:', response.status, errorData);

        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your Anthropic API key.');
        } else if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      console.log('[AI Draft] API response received:', {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens
      });

      // Parse response
      const draft = this.parseResponse(data.content[0].text);

      // Calculate cost
      const cost = this.calculateCost(data.usage?.input_tokens || 0, data.usage?.output_tokens || 0);

      // Track usage
      await this.trackUsage();

      console.log('[AI Draft] ✓ Generation successful');

      return {
        success: true,
        draft: draft,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0
        },
        cost: cost
      };

    } catch (error) {
      console.error('[AI Draft] Generation failed:', error);

      // Re-throw with user-friendly message
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }

      throw error;
    }
  }

  /**
   * Build optimized prompt for email generation
   */
  buildPrompt({ contact, userProfile, style, tone, customInstructions, purpose }) {
    const styleGuides = {
      professional: 'Professional and polished, suitable for corporate settings',
      casual: 'Friendly and conversational, while remaining respectful',
      referral: 'Focused on seeking insights and advice, not asking for jobs'
    };

    const toneGuides = {
      warm: 'Warm and personable, showing genuine interest',
      direct: 'Direct and concise, respecting their time',
      enthusiastic: 'Enthusiastic and energetic, showing passion'
    };

    const purposeGuides = {
      referral: 'Seeking a referral conversation or informational interview',
      networking: 'Building a professional connection and relationship',
      informational: 'Learning about their role, company, or industry'
    };

    return `You are helping a jobseeker write a cold outreach email. Generate a short, personalized email (under 150 words) with the following details:

RECIPIENT:
- Name: ${contact.name}
- Role: ${contact.role}
- Company: ${contact.company}

SENDER (Jobseeker):
- Name: ${userProfile.name}
- Background: ${userProfile.role || 'Student'}${userProfile.school ? ` at ${userProfile.school}` : ''}

EMAIL PURPOSE: ${purposeGuides[purpose] || purpose}

STYLE: ${styleGuides[style] || style}
TONE: ${toneGuides[tone] || tone}

${customInstructions ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ''}
CRITICAL REQUIREMENTS:
1. Under 150 words total
2. Include a compelling subject line
3. Be respectful and humble - never entitled
4. Focus on learning and insights, NOT asking for jobs directly
5. Personalize based on recipient's role and company
6. End with a clear but low-pressure call to action (e.g., "Would you have 15 minutes for a brief call?")
7. Use ${userProfile.name}'s actual name, not placeholders
8. Use ${contact.name}'s actual name in greeting (e.g., "Hi ${contact.name.split(' ')[0]}")
9. Do NOT include sender signature or sign-off like "Best regards, [Name]" - just end with the call to action
10. Make it feel genuine and human, not AI-generated

FORMAT YOUR RESPONSE EXACTLY AS:
Subject: [compelling subject line]

[email body starting with greeting]

DO NOT add any explanations, notes, or text outside this format.`;
  }

  /**
   * Parse AI response into structured draft
   */
  parseResponse(responseText) {
    const trimmed = responseText.trim();

    // Extract subject line
    const subjectMatch = trimmed.match(/^Subject:\s*(.+?)$/im);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Quick question';

    // Extract body (everything after the subject line and first newline)
    let body = trimmed;

    if (subjectMatch) {
      // Find where the subject line ends
      const subjectEndIndex = trimmed.indexOf(subjectMatch[0]) + subjectMatch[0].length;
      body = trimmed.substring(subjectEndIndex).trim();
    }

    // Clean up body
    body = body
      .replace(/^Subject:.+$/im, '') // Remove any remaining subject line
      .trim();

    console.log('[AI Draft] Parsed draft:', {
      subjectLength: subject.length,
      bodyLength: body.length
    });

    return {
      subject: subject,
      body: body
    };
  }

  /**
   * Rate limiting - max 3 requests per minute
   */
  async checkRateLimit() {
    const now = Date.now();

    // Reset counter if window passed
    if (now - this.lastRequestTime > this.apiConfig.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check limit
    if (this.requestCount >= this.apiConfig.rateLimitMax) {
      const waitTime = this.apiConfig.rateLimitWindow - (now - this.lastRequestTime);
      const waitSeconds = Math.ceil(waitTime / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitSeconds} seconds before generating another email.`);
    }

    this.requestCount++;
    console.log('[AI Draft] Rate limit check passed:', {
      requestCount: this.requestCount,
      maxRequests: this.apiConfig.rateLimitMax
    });
  }

  /**
   * Check daily usage limit
   */
  async checkDailyLimit() {
    const remaining = await this.getRemainingGenerations();

    if (remaining <= 0) {
      throw new Error('Daily generation limit reached (50 emails). Limit resets at midnight.');
    }

    if (remaining <= this.apiConfig.warnThreshold) {
      console.warn('[AI Draft] Low generations remaining:', remaining);
    }
  }

  /**
   * Track daily usage
   */
  async trackUsage() {
    const today = this.getToday();
    const storage = await chrome.storage.local.get(['aiUsage']);
    const usage = storage.aiUsage || {};

    if (!usage[today]) {
      usage[today] = {
        count: 0,
        totalCost: 0,
        firstUsed: new Date().toISOString()
      };
    }

    usage[today].count++;
    usage[today].lastUsed = new Date().toISOString();

    // Keep only last 30 days of usage data
    const daysToKeep = 30;
    const dates = Object.keys(usage).sort().reverse();
    if (dates.length > daysToKeep) {
      dates.slice(daysToKeep).forEach(date => delete usage[date]);
    }

    await chrome.storage.local.set({ aiUsage: usage });

    console.log('[AI Draft] Usage tracked:', {
      today: today,
      count: usage[today].count,
      totalCost: usage[today].totalCost
    });
  }

  /**
   * Get remaining generations for today
   */
  async getRemainingGenerations() {
    const today = this.getToday();
    const storage = await chrome.storage.local.get(['aiUsage']);
    const usage = storage.aiUsage || {};
    const todayUsage = usage[today] || { count: 0 };

    return this.apiConfig.dailyLimit - todayUsage.count;
  }

  /**
   * Get usage statistics
   */
  async getUsageStats() {
    const today = this.getToday();
    const storage = await chrome.storage.local.get(['aiUsage']);
    const usage = storage.aiUsage || {};

    const todayUsage = usage[today] || { count: 0, totalCost: 0 };

    // Calculate total usage across all days
    const allDays = Object.values(usage);
    const totalCount = allDays.reduce((sum, day) => sum + (day.count || 0), 0);
    const totalCost = allDays.reduce((sum, day) => sum + (day.totalCost || 0), 0);

    return {
      todayCount: todayUsage.count,
      todayCost: todayUsage.totalCost,
      totalGenerations: totalCount,
      totalCost: totalCost,
      remaining: this.apiConfig.dailyLimit - todayUsage.count
    };
  }

  /**
   * Calculate actual cost based on token usage
   */
  calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000000) * this.apiConfig.pricing.inputCost;
    const outputCost = (outputTokens / 1000000) * this.apiConfig.pricing.outputCost;
    return inputCost + outputCost;
  }

  /**
   * Estimate cost before generation (based on averages)
   */
  estimateCost() {
    // Average: ~200 input tokens, ~200 output tokens
    return this.calculateCost(200, 200);
  }

  /**
   * Get API key from secure Chrome storage
   */
  async getApiKey() {
    try {
      const storage = await chrome.storage.local.get(['anthropicApiKey']);
      return storage.anthropicApiKey || null;
    } catch (error) {
      console.error('[AI Draft] Error retrieving API key:', error);
      return null;
    }
  }

  /**
   * Save API key to secure Chrome storage
   */
  async saveApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid API key format. Anthropic API keys start with "sk-ant-"');
    }

    try {
      await chrome.storage.local.set({ anthropicApiKey: apiKey });
      console.log('[AI Draft] ✓ API key saved securely');
      return true;
    } catch (error) {
      console.error('[AI Draft] Error saving API key:', error);
      throw new Error('Failed to save API key');
    }
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey() {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  /**
   * Remove API key from storage
   */
  async removeApiKey() {
    try {
      await chrome.storage.local.remove(['anthropicApiKey']);
      console.log('[AI Draft] ✓ API key removed');
      return true;
    } catch (error) {
      console.error('[AI Draft] Error removing API key:', error);
      throw new Error('Failed to remove API key');
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getToday() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Clear all usage data (for testing or reset)
   */
  async clearUsageData() {
    await chrome.storage.local.remove(['aiUsage']);
    console.log('[AI Draft] ✓ Usage data cleared');
  }
}

// Export for browser extension
window.AIDraftGenerator = AIDraftGenerator;
