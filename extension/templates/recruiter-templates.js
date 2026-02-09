// Recruiter Outreach Templates
// Specialized templates for different outreach scenarios

class RecruiterTemplates {
  constructor() {
    // User profile placeholders - these will be replaced with actual user data
    this.userPlaceholders = {
      userName: '[Your Name]',
      userSchool: '[Your University]',
      userRole: '[Your Current Role]',
      userMajor: '[Your Major/Field]',
      userGradYear: '[Graduation Year]'
    };
  }

  /**
   * Get all available template types
   * @returns {Array<Object>} - Template metadata
   */
  getTemplateTypes() {
    return [
      {
        id: 'recruiter',
        name: 'To Recruiter',
        icon: '👔',
        description: 'Formal outreach to recruiters/HR',
        bestFor: 'Reaching out to talent acquisition professionals'
      },
      {
        id: 'referral',
        name: 'Referral Request',
        icon: '🤝',
        description: 'Request employee referral',
        bestFor: 'Asking fellow alumni or employees for referrals'
      },
      {
        id: 'advice',
        name: 'Seeking Advice',
        icon: '💬',
        description: 'Informational interview',
        bestFor: 'General networking and learning about roles'
      },
      {
        id: 'ai',
        name: 'AI Generated',
        icon: '✨',
        description: 'Personalized AI draft',
        bestFor: 'Custom message tailored to the contact'
      }
    ];
  }

  /**
   * Generate template based on type
   * @param {string} templateType - 'recruiter' | 'referral' | 'advice'
   * @param {Object} contact - Contact data
   * @param {Object} userProfile - User profile data (optional)
   * @returns {Object} - { subject, body }
   */
  generateTemplate(templateType, contact, userProfile = {}) {
    const firstName = contact.firstName || 'there';
    const company = contact.company || 'your company';
    const role = contact.role || '';

    // Merge user profile with placeholders
    const user = {
      ...this.userPlaceholders,
      ...userProfile
    };

    switch (templateType) {
      case 'recruiter':
        return this.getRecruiterTemplate(firstName, company, role, user, contact);

      case 'referral':
        return this.getReferralTemplate(firstName, company, role, user, contact);

      case 'advice':
        return this.getAdviceTemplate(firstName, company, role, user, contact);

      default:
        return this.getGenericTemplate(firstName, company, role, user);
    }
  }

  /**
   * Recruiter/HR Template
   * Professional and direct - focus on opportunities
   */
  getRecruiterTemplate(firstName, company, role, user, contact) {
    // Get company context if available
    let talkingPoint = 'the innovative work and culture';
    if (typeof companyContext !== 'undefined') {
      talkingPoint = companyContext.getTalkingPoint(company);
    }

    const subject = `Interested in opportunities at ${company}`;

    const body = `Hi ${firstName},

I noticed you're a ${role} at ${company}. I'm currently exploring opportunities in software engineering and would love to learn more about open positions at ${company}.

I have experience in [brief relevant skill/project - e.g., "full-stack development with React and Node.js"], and I'm particularly excited about ${talkingPoint}.

Would you be open to a brief chat about potential opportunities or advice on the application process?

Best regards,
${user.userName}
${user.userSchool} | ${user.userRole}`;

    return { subject, body };
  }

  /**
   * Referral Request Template
   * For fellow alumni or employees
   */
  getReferralTemplate(firstName, company, role, user, contact) {
    const subject = `${user.userSchool} grad seeking referral for ${company}`;

    // Check if same school
    const alumConnection = user.userSchool !== this.userPlaceholders.userSchool
      ? `I'm ${user.userName}, also a ${user.userSchool} alum! `
      : '';

    const body = `Hi ${firstName},

${alumConnection}I'm currently applying for [specific role - e.g., "Software Engineer, New Grad"] at ${company} and was hoping you might be able to provide a referral.

I have [X years/relevant experience - e.g., "internship experience in backend development"] in [field], and I'm particularly drawn to ${company} because [specific reason - e.g., "of its commitment to innovation and impact-driven culture"].

Happy to send my resume and answer any questions. Would really appreciate your support!

${alumConnection ? 'Go [school mascot]!' : 'Thanks in advance!'}

${user.userName}
${user.userSchool} '${user.userGradYear}`;

    return { subject, body };
  }

  /**
   * Advice/Informational Interview Template
   * Casual networking approach
   */
  getAdviceTemplate(firstName, company, role, user, contact) {
    const subject = `Quick question about working at ${company}`;

    const body = `Hi ${firstName},

I came across your profile and noticed you work as a ${role} at ${company}. I'm ${user.userName}, currently ${user.userRole}, and I'm considering applying for similar roles.

I'd love to hear about your experience, specifically:
• Team culture and work-life balance
• Growth opportunities in ${role.includes('Engineer') || role.includes('Developer') ? 'engineering' : 'your field'}
• Any advice for applicants

Would you have 15 minutes for a quick call or coffee chat?

Thanks!
${user.userName}
${user.userSchool}`;

    return { subject, body };
  }

  /**
   * Generic fallback template
   */
  getGenericTemplate(firstName, company, role, user) {
    const subject = `Connecting regarding ${company}`;

    const body = `Hi ${firstName},

I came across your profile${role ? ` and saw you work as ${role}` : ''} at ${company}. I'm ${user.userName}, and I'm interested in learning more about opportunities at ${company}.

Would you be open to a brief conversation?

Best regards,
${user.userName}`;

    return { subject, body };
  }

  /**
   * Enhance draft with company context
   * @param {string} draft - Original draft text
   * @param {string} company - Company name
   * @returns {string} - Enhanced draft
   */
  enhanceWithCompanyContext(draft, company) {
    if (typeof companyContext === 'undefined' || !companyContext.hasContext(company)) {
      return draft;
    }

    const context = companyContext.getContext(company);

    // Replace generic placeholders with specific talking points
    let enhanced = draft;

    // Replace [specific area you researched]
    if (enhanced.includes('[specific area you researched]')) {
      const talkingPoint = companyContext.getTalkingPoint(company);
      enhanced = enhanced.replace('[specific area you researched]', talkingPoint);
    }

    // Replace [specific reason - ...]
    const reasonMatch = enhanced.match(/\[specific reason - [^\]]+\]/);
    if (reasonMatch && context.values) {
      const reason = `its values of ${context.values}`;
      enhanced = enhanced.replace(reasonMatch[0], reason);
    }

    return enhanced;
  }

  /**
   * Get template recommendation based on contact role
   * @param {Object} contact - Contact data
   * @returns {string} - Recommended template ID
   */
  getRecommendation(contact) {
    // Use role detector if available
    if (typeof roleDetector !== 'undefined') {
      const detection = roleDetector.detectRecruiterRole(
        contact.role || '',
        contact.company || ''
      );
      return detection.recommendedTemplate;
    }

    // Fallback to simple keyword matching
    const role = (contact.role || '').toLowerCase();
    const company = (contact.company || '').toLowerCase();

    const recruiterKeywords = ['recruiter', 'talent', 'hr', 'hiring'];
    const isRecruiter = recruiterKeywords.some(keyword => role.includes(keyword));

    if (isRecruiter) {
      return 'recruiter';
    }

    const bigTech = ['google', 'meta', 'facebook', 'microsoft', 'amazon', 'apple'];
    const isBigTech = bigTech.some(tech => company.includes(tech));

    if (isBigTech) {
      return 'referral';
    }

    return 'advice';
  }

  /**
   * Set user profile data (for persistent customization)
   * @param {Object} profile - User profile
   */
  setUserProfile(profile) {
    this.userPlaceholders = {
      userName: profile.name || this.userPlaceholders.userName,
      userSchool: profile.school || this.userPlaceholders.userSchool,
      userRole: profile.role || this.userPlaceholders.userRole,
      userMajor: profile.major || this.userPlaceholders.userMajor,
      userGradYear: profile.gradYear || this.userPlaceholders.userGradYear
    };
  }

  /**
   * Get user profile placeholders
   * @returns {Object} - Current user profile
   */
  getUserProfile() {
    return { ...this.userPlaceholders };
  }
}

// Export singleton instance
const recruiterTemplates = new RecruiterTemplates();
