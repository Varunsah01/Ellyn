// Role Detection Utility
// Detects recruiter/HR roles and company types

class RoleDetector {
  constructor() {
    this.recruiterKeywords = [
      'recruiter',
      'talent acquisition',
      'hr',
      'human resources',
      'recruiting',
      'talent partner',
      'hiring',
      'staffing',
      'people operations',
      'talent',
      'headhunter',
      'sourcer'
    ];

    this.bigTechCompanies = [
      'google',
      'meta',
      'facebook',
      'microsoft',
      'amazon',
      'apple',
      'netflix',
      'tesla',
      'uber',
      'lyft',
      'airbnb',
      'stripe',
      'salesforce',
      'adobe',
      'oracle',
      'ibm',
      'twitter',
      'x corp',
      'linkedin',
      'snapchat',
      'pinterest',
      'spotify',
      'nvidia',
      'intel',
      'amd',
      'qualcomm',
      'cisco',
      'vmware',
      'databricks',
      'snowflake',
      'servicenow',
      'workday',
      'zoom',
      'slack',
      'twilio',
      'cloudflare',
      'shopify',
      'square',
      'paypal',
      'coinbase',
      'robinhood'
    ];
  }

  /**
   * Detect if contact is a recruiter
   * @param {string} role - Job title/role
   * @param {string} company - Company name
   * @returns {Object} - { isRecruiter, isBigTech, recommendedTemplate, confidence }
   */
  detectRecruiterRole(role = '', company = '') {
    const roleLower = role.toLowerCase();
    const companyLower = company.toLowerCase();

    // Check if role contains recruiter keywords
    const isRecruiter = this.recruiterKeywords.some(keyword =>
      roleLower.includes(keyword)
    );

    // Check if company is big tech
    const isBigTech = this.bigTechCompanies.some(tech =>
      companyLower.includes(tech)
    );

    // Calculate confidence score
    let confidence = 0;
    if (isRecruiter) {
      if (roleLower.includes('senior') || roleLower.includes('lead')) {
        confidence = 90;
      } else if (roleLower.includes('technical')) {
        confidence = 85;
      } else {
        confidence = 80;
      }
    }

    // Determine recommended template
    let recommendedTemplate = 'advice'; // Default: networking/advice
    if (isRecruiter && isBigTech) {
      recommendedTemplate = 'recruiter'; // Formal recruiter template
    } else if (isRecruiter) {
      recommendedTemplate = 'recruiter'; // General recruiter template
    } else if (isBigTech) {
      recommendedTemplate = 'referral'; // Employee referral request
    }

    return {
      isRecruiter,
      isBigTech,
      recommendedTemplate,
      confidence,
      metadata: {
        role: role,
        company: company,
        detectedKeywords: this.recruiterKeywords.filter(k => roleLower.includes(k))
      }
    };
  }

  /**
   * Check if company is big tech
   * @param {string} company - Company name
   * @returns {boolean}
   */
  isBigTech(company = '') {
    const companyLower = company.toLowerCase();
    return this.bigTechCompanies.some(tech =>
      companyLower.includes(tech)
    );
  }

  /**
   * Get company type/tier
   * @param {string} company - Company name
   * @returns {string} - 'big-tech' | 'startup' | 'enterprise' | 'unknown'
   */
  getCompanyType(company = '') {
    const companyLower = company.toLowerCase();

    if (this.isBigTech(company)) {
      return 'big-tech';
    }

    // Basic heuristics (can be enhanced later)
    const startupIndicators = ['inc', 'labs', 'ai', 'tech', 'app'];
    const enterpriseIndicators = ['corporation', 'corp', 'group', 'limited', 'llc'];

    const hasStartupIndicators = startupIndicators.some(i => companyLower.includes(i));
    const hasEnterpriseIndicators = enterpriseIndicators.some(i => companyLower.includes(i));

    if (hasStartupIndicators) return 'startup';
    if (hasEnterpriseIndicators) return 'enterprise';

    return 'unknown';
  }
}

// Export singleton instance
const roleDetector = new RoleDetector();
