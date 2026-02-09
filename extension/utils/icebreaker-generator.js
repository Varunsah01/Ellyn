// Icebreaker Generator
// Creates personalized opening lines based on shared context

class IcebreakerGenerator {
  constructor() {
    this.priorities = [
      'sameSchool',
      'mutualConnections',
      'recentActivity',
      'sharedLocation',
      'companyInterest',
      'skillsAlignment',
      'certifications',
      'volunteer'
    ];
  }

  /**
   * Generate best icebreaker based on contact context
   * @param {Object} contact - Contact with rich context
   * @param {Object} userProfile - User's profile
   * @returns {Object} - { text, type, confidence }
   */
  generateIcebreaker(contact, userProfile) {
    // Try each priority in order
    for (const priority of this.priorities) {
      const icebreaker = this[`_${priority}`](contact, userProfile);
      if (icebreaker) {
        return {
          text: icebreaker,
          type: priority,
          confidence: this._getConfidence(priority)
        };
      }
    }

    // Fallback to generic
    return this._genericFallback(contact, userProfile);
  }

  /**
   * Generate multiple icebreaker options
   * @param {Object} contact
   * @param {Object} userProfile
   * @returns {Array} - Multiple icebreaker options
   */
  generateOptions(contact, userProfile) {
    const options = [];

    // Add all applicable icebreakers
    for (const priority of this.priorities) {
      const icebreaker = this[`_${priority}`](contact, userProfile);
      if (icebreaker) {
        options.push({
          text: icebreaker,
          type: priority,
          confidence: this._getConfidence(priority),
          label: this._getLabel(priority)
        });
      }
    }

    // Add generic fallback
    const fallback = this._genericFallback(contact, userProfile);
    options.push(fallback);

    return options;
  }

  /**
   * Priority 1: Same school
   */
  _sameSchool(contact, userProfile) {
    if (!contact.school || !userProfile.school) return null;

    const contactSchool = contact.school.toLowerCase();
    const userSchool = userProfile.school.toLowerCase();

    if (contactSchool.includes(userSchool) || userSchool.includes(contactSchool)) {
      const variants = [
        `Fellow ${contact.school} alum here!`,
        `I see we both went to ${contact.school}!`,
        `${contact.school} represent!`,
        `Always great to connect with another ${contact.school} grad`
      ];

      return this._randomChoice(variants);
    }

    return null;
  }

  /**
   * Priority 2: Mutual connections
   */
  _mutualConnections(contact, userProfile) {
    if (!contact.mutualConnections || contact.mutualConnections === 0) return null;

    const count = contact.mutualConnections;

    if (count === 1) {
      return `I noticed we have a mutual connection!`;
    } else if (count === 2) {
      return `I saw we have a couple mutual connections`;
    } else if (count <= 5) {
      return `I noticed we have ${count} mutual connections`;
    } else {
      return `Looks like we're well connected - ${count} mutual connections!`;
    }
  }

  /**
   * Priority 3: Recent activity/posts
   */
  _recentActivity(contact, userProfile) {
    if (!contact.recentPosts || contact.recentPosts.length === 0) return null;

    const post = contact.recentPosts[0];
    const topic = this._extractTopic(post.snippet);

    if (!topic) return null;

    const variants = [
      `I really enjoyed your recent post about ${topic}`,
      `Your post on ${topic} really resonated with me`,
      `Saw your thoughts on ${topic} - great insights!`,
      `Your recent post about ${topic} caught my attention`
    ];

    return this._randomChoice(variants);
  }

  /**
   * Priority 4: Shared location
   */
  _sharedLocation(contact, userProfile) {
    if (!contact.location || !userProfile.location) return null;

    const contactLoc = contact.location.toLowerCase();
    const userLoc = userProfile.location.toLowerCase();

    // Check if same city/area
    if (contactLoc.includes(userLoc) || userLoc.includes(contactLoc)) {
      const variants = [
        `I see we're both based in ${contact.location}`,
        `Fellow ${contact.location} resident here!`,
        `Always great to connect with someone local in ${contact.location}`
      ];

      return this._randomChoice(variants);
    }

    return null;
  }

  /**
   * Priority 5: Company interest
   */
  _companyInterest(contact, userProfile) {
    if (!contact.company) return null;

    const variants = [
      `I've been following ${contact.company}'s work`,
      `${contact.company} is doing amazing things in ${this._inferIndustry(contact)}`,
      `I'm really impressed by ${contact.company}'s recent growth`,
      `${contact.company} has been on my radar for a while`
    ];

    return this._randomChoice(variants);
  }

  /**
   * Priority 6: Skills alignment
   */
  _skillsAlignment(contact, userProfile) {
    if (!contact.skills || contact.skills.length === 0) return null;
    if (!userProfile.skills || userProfile.skills.length === 0) return null;

    // Find overlapping skills
    const contactSkills = contact.skills.map(s => s.toLowerCase());
    const userSkills = userProfile.skills.map(s => s.toLowerCase());

    const sharedSkills = contactSkills.filter(s =>
      userSkills.some(us => us.includes(s) || s.includes(us))
    );

    if (sharedSkills.length > 0) {
      const skill = contact.skills[contactSkills.indexOf(sharedSkills[0])];
      return `I see we both have experience with ${skill}`;
    }

    // Mention their top skill
    if (contact.skills[0]) {
      return `Your expertise in ${contact.skills[0]} is impressive`;
    }

    return null;
  }

  /**
   * Priority 7: Certifications
   */
  _certifications(contact, userProfile) {
    if (!contact.certifications || contact.certifications.length === 0) return null;

    const cert = contact.certifications[0];

    const variants = [
      `I noticed your ${cert} certification`,
      `Impressive that you're certified in ${cert}`,
      `I see you've earned your ${cert}!`
    ];

    return this._randomChoice(variants);
  }

  /**
   * Priority 8: Volunteer work
   */
  _volunteer(contact, userProfile) {
    if (!contact.volunteerWork) return null;

    return `I really admire your volunteer work with ${contact.volunteerWork}`;
  }

  /**
   * Generic fallback
   */
  _genericFallback(contact, userProfile) {
    const variants = [
      `I came across your profile and was impressed by your work at ${contact.company}`,
      `Your experience as ${contact.role} caught my attention`,
      `I've been researching ${contact.role} roles and your profile stood out`,
      `I'm really interested in ${contact.company} and thought I'd reach out`
    ];

    return {
      text: this._randomChoice(variants),
      type: 'generic',
      confidence: 50,
      label: 'General Interest'
    };
  }

  /**
   * Extract topic from post snippet
   */
  _extractTopic(snippet) {
    if (!snippet || snippet.length < 10) return null;

    // Clean up snippet
    let topic = snippet
      .replace(/^(I'm|I am|Just|Today|This|Check out|New|Excited about)\s+/i, '')
      .replace(/\s+(post|article|blog|update|share)$/i, '')
      .trim();

    // Limit length
    if (topic.length > 50) {
      topic = topic.substring(0, 47) + '...';
    }

    return topic || null;
  }

  /**
   * Infer industry from company/role
   */
  _inferIndustry(contact) {
    const company = (contact.company || '').toLowerCase();
    const role = (contact.role || '').toLowerCase();

    if (company.includes('google') || company.includes('meta') || company.includes('microsoft')) {
      return 'tech';
    }

    if (role.includes('software') || role.includes('engineer')) {
      return 'engineering';
    }

    if (role.includes('data') || role.includes('analytics')) {
      return 'data science';
    }

    if (role.includes('product')) {
      return 'product development';
    }

    if (role.includes('recruiter') || role.includes('talent')) {
      return 'talent acquisition';
    }

    return 'your industry';
  }

  /**
   * Get confidence score for each type
   */
  _getConfidence(type) {
    const scores = {
      sameSchool: 95,
      mutualConnections: 90,
      recentActivity: 85,
      sharedLocation: 80,
      companyInterest: 70,
      skillsAlignment: 75,
      certifications: 70,
      volunteer: 65,
      generic: 50
    };

    return scores[type] || 50;
  }

  /**
   * Get label for each type
   */
  _getLabel(type) {
    const labels = {
      sameSchool: 'Shared School',
      mutualConnections: 'Mutual Connections',
      recentActivity: 'Recent Post',
      sharedLocation: 'Same Location',
      companyInterest: 'Company Interest',
      skillsAlignment: 'Shared Skills',
      certifications: 'Certifications',
      volunteer: 'Volunteer Work',
      generic: 'General Interest'
    };

    return labels[type] || 'Unknown';
  }

  /**
   * Random choice helper
   */
  _randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate complete opening paragraph
   * @param {Object} contact
   * @param {Object} userProfile
   * @returns {string}
   */
  generateOpening(contact, userProfile) {
    const icebreaker = this.generateIcebreaker(contact, userProfile);

    // Add transition to purpose
    const transitions = [
      'I\'m reaching out because',
      'I wanted to connect because',
      'The reason I\'m contacting you is',
      'I\'m getting in touch because'
    ];

    const transition = this._randomChoice(transitions);

    return `${icebreaker.text}. ${transition}`;
  }
}

// Export singleton instance
const icebreakerGenerator = new IcebreakerGenerator();
