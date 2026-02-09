// Subject Line Generator
// Creates compelling, personalized subject lines

class SubjectLineGenerator {
  constructor() {
    this.templates = {
      sameSchool: [
        '{school} grad seeking {type} for {company}',
        'Fellow {school} alum → {company} opportunity',
        '{school} connection: {topic}',
        '{school} to {company}: quick question'
      ],

      mutualConnections: [
        'Connection via {name} ({company})',
        '{mutualCount} mutual contacts → quick question',
        'Intro via our mutual connections',
        'Quick question (we have {mutualCount} connections in common)'
      ],

      recentActivity: [
        'Re: Your post on {topic}',
        'Loved your thoughts on {topic}',
        'Following up on your {postType} about {topic}',
        'Your {topic} post resonated with me'
      ],

      companyFocused: [
        'Quick question about {role} at {company}',
        'Interested in {company} - brief chat?',
        '{company} {role} opportunity',
        'Learning more about {company}'
      ],

      referralRequest: [
        'Referral request for {company}',
        'Quick referral question about {company}',
        '{userName} → {contactName}: {company} referral',
        'Would love an intro to {company}'
      ],

      adviceRequest: [
        'Seeking advice on {topic}',
        'Question about your experience at {company}',
        'Career advice from a {role}?',
        'Learning from your {company} experience'
      ],

      generic: [
        '{userName} → {contactName}: {topic}',
        'Quick question about {topic}',
        'Interested in connecting',
        'Brief question about {company}'
      ]
    };

    // Subject line best practices
    this.bestPractices = {
      maxLength: 60,
      idealLength: 50,
      avoidWords: ['help', 'please', 'sorry', 'quick favor'],
      powerWords: ['opportunity', 'insight', 'advice', 'question', 'intro']
    };
  }

  /**
   * Generate subject lines based on contact context
   * @param {Object} contact - Contact with rich context
   * @param {Object} userProfile - User's profile
   * @param {string} emailType - 'referral' | 'advice' | 'networking'
   * @returns {Array} - Array of subject line options
   */
  generateSubjectLines(contact, userProfile, emailType = 'referral') {
    const options = [];

    // Priority-based generation
    const priorities = [
      'sameSchool',
      'mutualConnections',
      'recentActivity',
      'companyFocused',
      emailType + 'Request',
      'generic'
    ];

    for (const priority of priorities) {
      const subjects = this._generateForType(priority, contact, userProfile, emailType);
      if (subjects && subjects.length > 0) {
        options.push(...subjects);
      }
    }

    // Score and sort
    return options
      .map(subject => ({
        text: subject,
        score: this._scoreSubjectLine(subject),
        length: subject.length,
        category: this._categorize(subject, contact, userProfile)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Return top 5
  }

  /**
   * Generate for specific type
   */
  _generateForType(type, contact, userProfile, emailType) {
    const templates = this.templates[type];
    if (!templates) return [];

    const subjects = [];

    for (const template of templates) {
      const subject = this._fillTemplate(template, contact, userProfile, emailType);
      if (subject && subject.length <= this.bestPractices.maxLength) {
        subjects.push(subject);
      }
    }

    return subjects;
  }

  /**
   * Fill template with actual data
   */
  _fillTemplate(template, contact, userProfile, emailType) {
    let filled = template;

    // Basic replacements
    const replacements = {
      '{school}': contact.school || userProfile.school || '',
      '{company}': contact.company || '',
      '{role}': contact.role || '',
      '{userName}': userProfile.name || 'Student',
      '{contactName}': contact.firstName || '',
      '{topic}': this._getTopic(contact, emailType),
      '{type}': emailType,
      '{mutualCount}': contact.mutualConnections || 0,
      '{name}': this._getMutualName(contact),
      '{postType}': contact.recentPosts?.[0]?.type || 'post'
    };

    for (const [key, value] of Object.entries(replacements)) {
      filled = filled.replace(key, value);
    }

    // Clean up
    filled = filled
      .replace(/\s+/g, ' ')
      .replace(/\s+-\s+$/, '')
      .replace(/:\s+$/, '')
      .trim();

    return filled || null;
  }

  /**
   * Get topic for subject line
   */
  _getTopic(contact, emailType) {
    // If recent post, use post topic
    if (contact.recentPosts && contact.recentPosts.length > 0) {
      const post = contact.recentPosts[0];
      const topic = post.snippet.split('\n')[0].substring(0, 30);
      return topic;
    }

    // Use email type
    const topics = {
      referral: 'referral',
      advice: 'career advice',
      networking: 'networking',
      job: 'opportunities'
    };

    return topics[emailType] || 'quick question';
  }

  /**
   * Get mutual connection name (if available)
   */
  _getMutualName(contact) {
    // This would need actual mutual connection data
    // For now, return generic
    return 'our mutual connection';
  }

  /**
   * Score subject line quality
   */
  _scoreSubjectLine(subject) {
    let score = 100;

    // Length scoring
    const length = subject.length;
    if (length > this.bestPractices.maxLength) {
      score -= (length - this.bestPractices.maxLength) * 2;
    } else if (length < 20) {
      score -= (20 - length) * 1;
    } else if (length <= this.bestPractices.idealLength) {
      score += 10; // Bonus for ideal length
    }

    // Word scoring
    const lower = subject.toLowerCase();

    // Penalize bad words
    for (const word of this.bestPractices.avoidWords) {
      if (lower.includes(word)) {
        score -= 10;
      }
    }

    // Bonus for power words
    for (const word of this.bestPractices.powerWords) {
      if (lower.includes(word)) {
        score += 5;
      }
    }

    // Bonus for personalization
    if (this._hasPersonalization(subject)) {
      score += 15;
    }

    // Bonus for specificity
    if (this._isSpecific(subject)) {
      score += 10;
    }

    // Penalize generic phrases
    if (lower.includes('quick question') && lower.length < 30) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if subject has personalization
   */
  _hasPersonalization(subject) {
    const personalMarkers = [
      /[A-Z][a-z]+ (alum|grad|connection)/,
      /\d+ mutual/,
      /Re: Your/,
      /Fellow/,
      /\w+ → \w+/
    ];

    return personalMarkers.some(marker => marker.test(subject));
  }

  /**
   * Check if subject is specific
   */
  _isSpecific(subject) {
    // Has company name, role, or specific topic
    const hasCompany = /[A-Z][a-z]+/.test(subject);
    const hasRole = /(Engineer|Manager|Recruiter|Analyst|Designer)/i.test(subject);
    const hasTopic = /about \w+/.test(subject);

    return hasCompany || hasRole || hasTopic;
  }

  /**
   * Categorize subject line
   */
  _categorize(subject, contact, userProfile) {
    const lower = subject.toLowerCase();

    if (contact.school && userProfile.school &&
        lower.includes(contact.school.toLowerCase())) {
      return 'Shared School';
    }

    if (lower.includes('mutual')) {
      return 'Mutual Connections';
    }

    if (lower.includes('re:') || lower.includes('post')) {
      return 'Recent Activity';
    }

    if (lower.includes('referral')) {
      return 'Referral Request';
    }

    if (lower.includes('advice') || lower.includes('question')) {
      return 'Advice Request';
    }

    return 'General';
  }

  /**
   * Generate A/B test variants
   * @param {string} baseSubject
   * @returns {Array}
   */
  generateVariants(baseSubject) {
    const variants = [
      { text: baseSubject, variant: 'Original' }
    ];

    // Variant 1: Add emoji
    if (!baseSubject.includes('→')) {
      variants.push({
        text: baseSubject.replace(/^/, '💼 '),
        variant: 'With Emoji'
      });
    }

    // Variant 2: Make more direct
    const directVersion = baseSubject
      .replace(/Quick question about/, 'Question about')
      .replace(/Interested in/, 'Re:')
      .replace(/Would love/, 'Seeking');

    if (directVersion !== baseSubject) {
      variants.push({
        text: directVersion,
        variant: 'More Direct'
      });
    }

    // Variant 3: Add urgency (if appropriate)
    if (!baseSubject.toLowerCase().includes('quick') &&
        !baseSubject.toLowerCase().includes('brief')) {
      variants.push({
        text: 'Quick: ' + baseSubject,
        variant: 'With Urgency'
      });
    }

    return variants;
  }

  /**
   * Predict open rate (simple heuristic)
   * @param {string} subject
   * @returns {number} - Predicted open rate percentage
   */
  predictOpenRate(subject) {
    const score = this._scoreSubjectLine(subject);

    // Convert score (0-100) to open rate (10-40%)
    // Industry average is ~20-25%
    const baseRate = 15;
    const scoreBonus = (score / 100) * 25;

    return Math.round(baseRate + scoreBonus);
  }

  /**
   * Get subject line tips
   * @param {string} subject
   * @returns {Array}
   */
  getTips(subject) {
    const tips = [];

    // Length tip
    if (subject.length > this.bestPractices.maxLength) {
      tips.push({
        type: 'warning',
        text: `Subject line is ${subject.length - this.bestPractices.maxLength} characters too long. Aim for under 60.`
      });
    }

    // Personalization tip
    if (!this._hasPersonalization(subject)) {
      tips.push({
        type: 'suggestion',
        text: 'Add personalization (school, mutual connections, or recent activity) to increase open rates.'
      });
    }

    // Specificity tip
    if (!this._isSpecific(subject)) {
      tips.push({
        type: 'suggestion',
        text: 'Be more specific. Mention the company, role, or topic to grab attention.'
      });
    }

    // Generic phrase tip
    const lower = subject.toLowerCase();
    if (lower.includes('quick question') && lower === 'quick question') {
      tips.push({
        type: 'warning',
        text: '"Quick question" is too generic. Add context about what the question is about.'
      });
    }

    return tips;
  }
}

// Export singleton instance
const subjectLineGenerator = new SubjectLineGenerator();
