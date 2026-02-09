// LinkedIn Context Extractor
// Extracts rich context from LinkedIn profiles for personalization

class ContextExtractor {
  constructor() {
    this.defaultContext = {
      school: null,
      location: null,
      headline: null,
      about: null,
      recentPosts: [],
      skills: [],
      mutualConnections: 0,
      companySize: null,
      yearsAtCompany: null,
      profileViews: null,
      languages: [],
      certifications: [],
      volunteerWork: null
    };
  }

  /**
   * Extract rich context from LinkedIn profile page
   * @param {Document} doc - LinkedIn profile page document
   * @returns {Object} - Enriched contact context
   */
  extractRichContext(doc = document) {
    try {
      const context = {
        // Basic info
        school: this.extractSchool(doc),
        location: this.extractLocation(doc),
        headline: this.extractHeadline(doc),
        about: this.extractAbout(doc),

        // Activity & engagement
        recentPosts: this.extractRecentActivity(doc),
        skills: this.extractTopSkills(doc, 5),

        // Social proof
        mutualConnections: this.extractMutualConnections(doc),

        // Company context
        companySize: this.extractCompanySize(doc),
        yearsAtCompany: this.calculateTenure(doc),

        // Additional context
        languages: this.extractLanguages(doc),
        certifications: this.extractCertifications(doc),
        volunteerWork: this.extractVolunteerWork(doc)
      };

      console.log('[ContextExtractor] Extracted rich context:', context);
      return context;

    } catch (error) {
      console.error('[ContextExtractor] Error:', error);
      return this.defaultContext;
    }
  }

  /**
   * Extract school/university
   */
  extractSchool(doc) {
    try {
      // Look for education section
      const educationSection = doc.querySelector('[id*="education"]') ||
                               doc.querySelector('.pvs-list__container');

      if (!educationSection) return null;

      // Try to find school name
      const schoolElement = educationSection.querySelector('.t-bold span[aria-hidden="true"]') ||
                           educationSection.querySelector('.pv-entity__school-name');

      if (schoolElement) {
        return schoolElement.textContent.trim();
      }

      // Fallback: search for common university patterns
      const text = educationSection.textContent;
      const universityMatch = text.match(/(University|College|Institute|School) of [A-Z][a-z]+/);
      if (universityMatch) {
        return universityMatch[0];
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] School extraction error:', error);
      return null;
    }
  }

  /**
   * Extract location
   */
  extractLocation(doc) {
    try {
      // Try top card location
      const locationElement = doc.querySelector('.text-body-small.inline.t-black--light.break-words') ||
                             doc.querySelector('.pv-top-card--list-bullet li:first-child');

      if (locationElement) {
        const location = locationElement.textContent.trim();
        // Clean up (remove "Contact info" etc.)
        return location.replace(/Contact info/i, '').trim();
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] Location extraction error:', error);
      return null;
    }
  }

  /**
   * Extract headline
   */
  extractHeadline(doc) {
    try {
      const headlineElement = doc.querySelector('.text-body-medium.break-words') ||
                             doc.querySelector('.pv-top-card--headline');

      if (headlineElement) {
        return headlineElement.textContent.trim().substring(0, 200);
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] Headline extraction error:', error);
      return null;
    }
  }

  /**
   * Extract about section
   */
  extractAbout(doc) {
    try {
      // Look for about section
      const aboutSection = doc.querySelector('[id*="about"]');

      if (!aboutSection) return null;

      // Get about text
      const aboutText = aboutSection.querySelector('.inline-show-more-text span[aria-hidden="true"]') ||
                       aboutSection.querySelector('.pv-about__summary-text');

      if (aboutText) {
        // Return first 200 characters
        return aboutText.textContent.trim().substring(0, 200);
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] About extraction error:', error);
      return null;
    }
  }

  /**
   * Extract recent posts/activity
   */
  extractRecentActivity(doc) {
    try {
      // Look for activity section
      const activitySection = doc.querySelector('[id*="activity"]') ||
                             doc.querySelector('.pv-recent-activity-section');

      if (!activitySection) return [];

      const posts = [];
      const postElements = activitySection.querySelectorAll('.occludable-update');

      for (let i = 0; i < Math.min(postElements.length, 2); i++) {
        const postElement = postElements[i];
        const text = postElement.textContent.trim();

        // Extract topic (first line or first 100 chars)
        const topic = text.split('\n')[0].substring(0, 100);

        // Try to detect post type
        const isArticle = text.toLowerCase().includes('article');
        const isImage = text.toLowerCase().includes('image');
        const isVideo = text.toLowerCase().includes('video');

        posts.push({
          snippet: topic,
          type: isArticle ? 'article' : isImage ? 'image' : isVideo ? 'video' : 'post',
          text: text.substring(0, 200)
        });
      }

      return posts;
    } catch (error) {
      console.error('[ContextExtractor] Recent activity extraction error:', error);
      return [];
    }
  }

  /**
   * Extract top skills
   */
  extractTopSkills(doc, limit = 5) {
    try {
      // Look for skills section
      const skillsSection = doc.querySelector('[id*="skills"]');

      if (!skillsSection) return [];

      const skills = [];
      const skillElements = skillsSection.querySelectorAll('.hoverable-link-text span[aria-hidden="true"]');

      for (let i = 0; i < Math.min(skillElements.length, limit); i++) {
        const skill = skillElements[i].textContent.trim();
        if (skill && !skills.includes(skill)) {
          skills.push(skill);
        }
      }

      return skills;
    } catch (error) {
      console.error('[ContextExtractor] Skills extraction error:', error);
      return [];
    }
  }

  /**
   * Extract mutual connections count
   */
  extractMutualConnections(doc) {
    try {
      // Look for mutual connections text
      const mutualElement = doc.querySelector('.text-body-small span[aria-hidden="true"]');

      if (mutualElement) {
        const text = mutualElement.textContent;
        const match = text.match(/(\d+)\s+mutual/i);

        if (match) {
          return parseInt(match[1], 10);
        }
      }

      return 0;
    } catch (error) {
      console.error('[ContextExtractor] Mutual connections extraction error:', error);
      return 0;
    }
  }

  /**
   * Extract company size
   */
  extractCompanySize(doc) {
    try {
      // Look for experience section
      const experienceSection = doc.querySelector('[id*="experience"]');

      if (!experienceSection) return null;

      // Look for company size indicator
      const text = experienceSection.textContent;
      const sizeMatch = text.match(/(\d+[\d,]*)\s*[-–]\s*(\d+[\d,]*)\s*employees/i);

      if (sizeMatch) {
        return `${sizeMatch[1]}-${sizeMatch[2]} employees`;
      }

      // Try to infer from company name
      const companyElement = experienceSection.querySelector('.t-bold span[aria-hidden="true"]');
      if (companyElement) {
        const company = companyElement.textContent.trim().toLowerCase();

        // Big tech companies
        if (['google', 'meta', 'microsoft', 'amazon', 'apple'].some(c => company.includes(c))) {
          return '10,000+ employees';
        }
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] Company size extraction error:', error);
      return null;
    }
  }

  /**
   * Calculate years at current company
   */
  calculateTenure(doc) {
    try {
      // Look for experience section
      const experienceSection = doc.querySelector('[id*="experience"]');

      if (!experienceSection) return null;

      // Get first (current) experience entry
      const currentExp = experienceSection.querySelector('.pvs-list__item--line-separated');

      if (!currentExp) return null;

      // Look for duration text
      const durationElement = currentExp.querySelector('.t-black--light span[aria-hidden="true"]');

      if (durationElement) {
        const text = durationElement.textContent;

        // Match patterns like "2 yrs 3 mos" or "6 mos"
        const yearsMatch = text.match(/(\d+)\s*yr/i);
        const monthsMatch = text.match(/(\d+)\s*mo/i);

        let totalMonths = 0;
        if (yearsMatch) totalMonths += parseInt(yearsMatch[1]) * 12;
        if (monthsMatch) totalMonths += parseInt(monthsMatch[1]);

        if (totalMonths > 0) {
          const years = Math.floor(totalMonths / 12);
          const months = totalMonths % 12;

          if (years > 0 && months > 0) {
            return `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
          } else if (years > 0) {
            return `${years} yr${years > 1 ? 's' : ''}`;
          } else {
            return `${months} mo${months > 1 ? 's' : ''}`;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] Tenure calculation error:', error);
      return null;
    }
  }

  /**
   * Extract languages
   */
  extractLanguages(doc) {
    try {
      // Look for languages section (usually in "About" or separate section)
      const languagesSection = doc.querySelector('[id*="languages"]');

      if (!languagesSection) return [];

      const languages = [];
      const langElements = languagesSection.querySelectorAll('.hoverable-link-text span[aria-hidden="true"]');

      for (let i = 0; i < langElements.length; i++) {
        const lang = langElements[i].textContent.trim();
        if (lang && !languages.includes(lang)) {
          languages.push(lang);
        }
      }

      return languages;
    } catch (error) {
      console.error('[ContextExtractor] Languages extraction error:', error);
      return [];
    }
  }

  /**
   * Extract certifications
   */
  extractCertifications(doc) {
    try {
      // Look for licenses & certifications section
      const certsSection = doc.querySelector('[id*="licenses"]') ||
                          doc.querySelector('[id*="certifications"]');

      if (!certsSection) return [];

      const certs = [];
      const certElements = certsSection.querySelectorAll('.t-bold span[aria-hidden="true"]');

      for (let i = 0; i < Math.min(certElements.length, 3); i++) {
        const cert = certElements[i].textContent.trim();
        if (cert && !certs.includes(cert)) {
          certs.push(cert);
        }
      }

      return certs;
    } catch (error) {
      console.error('[ContextExtractor] Certifications extraction error:', error);
      return [];
    }
  }

  /**
   * Extract volunteer work
   */
  extractVolunteerWork(doc) {
    try {
      // Look for volunteering section
      const volunteerSection = doc.querySelector('[id*="volunteer"]');

      if (!volunteerSection) return null;

      // Get first volunteer experience
      const volunteerElement = volunteerSection.querySelector('.t-bold span[aria-hidden="true"]');

      if (volunteerElement) {
        return volunteerElement.textContent.trim();
      }

      return null;
    } catch (error) {
      console.error('[ContextExtractor] Volunteer work extraction error:', error);
      return null;
    }
  }

  /**
   * Build enriched context object for AI prompt
   */
  buildEnrichedPrompt(contact, userProfile) {
    const sharedContext = [];

    // Check for shared school
    if (contact.school && userProfile.school &&
        contact.school.toLowerCase() === userProfile.school.toLowerCase()) {
      sharedContext.push(`- We both attended ${contact.school}`);
    }

    // Check for mutual connections
    if (contact.mutualConnections > 0) {
      sharedContext.push(`- ${contact.mutualConnections} mutual connection${contact.mutualConnections > 1 ? 's' : ''}`);
    }

    // Check for same location
    if (contact.location && userProfile.location &&
        contact.location.toLowerCase().includes(userProfile.location.toLowerCase())) {
      sharedContext.push(`- We're both in ${contact.location}`);
    }

    // Build prompt
    return `Generate a personalized outreach email to:

Name: ${contact.firstName} ${contact.lastName}
Role: ${contact.role} at ${contact.company}
${contact.school ? 'School: ' + contact.school : ''}
${contact.location ? 'Location: ' + contact.location : ''}
${contact.headline ? 'Headline: ' + contact.headline : ''}
${contact.about ? 'About: ' + contact.about : ''}
${contact.yearsAtCompany ? 'Tenure: ' + contact.yearsAtCompany + ' at current company' : ''}
${contact.skills.length > 0 ? 'Top Skills: ' + contact.skills.join(', ') : ''}

${sharedContext.length > 0 ? 'Shared context:\n' + sharedContext.join('\n') : ''}

${contact.recentPosts.length > 0 ? 'Recent activity:\n' + contact.recentPosts.map(p => '- ' + p.snippet).join('\n') : ''}

${contact.certifications && contact.certifications.length > 0 ? 'Certifications: ' + contact.certifications.join(', ') : ''}
${contact.volunteerWork ? 'Volunteer: ' + contact.volunteerWork : ''}

Write a warm, personalized outreach email that:
1. ${sharedContext.length > 0 ? 'Mentions our shared connection/school/location' : 'Opens with a genuine compliment about their work'}
2. ${contact.recentPosts.length > 0 ? 'References their recent LinkedIn activity' : 'Shows interest in their role/company'}
3. Shows genuine interest and respect for their time
4. Has a clear, specific ask (referral, advice, or introduction)
5. Keeps it under 150 words
6. Uses a conversational, warm tone (not overly formal)

Subject line should be personalized and intriguing.`;
  }
}

// Export singleton instance
const contextExtractor = new ContextExtractor();
