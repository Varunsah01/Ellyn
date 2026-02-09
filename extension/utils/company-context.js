// Company Context Database
// Pre-filled talking points and context for major companies

class CompanyContext {
  constructor() {
    this.companyData = {
      'google': {
        values: 'innovation, user focus, moonshots',
        culture: 'data-driven, collaborative, 20% time',
        talkingPoints: [
          'Google\'s mission to organize the world\'s information',
          'innovations in AI and machine learning',
          'work on products like Search, YouTube, or Cloud',
          'impact-driven engineering culture'
        ],
        products: ['Search', 'YouTube', 'Cloud', 'Android', 'Chrome', 'Maps']
      },
      'meta': {
        values: 'move fast, be bold, focus on impact',
        culture: 'feedback culture, hackathons, bottom-up innovation',
        talkingPoints: [
          'Meta\'s mission to bring people together',
          'innovations in social technology and VR/AR',
          'work on Facebook, Instagram, WhatsApp, or Reality Labs',
          'building the metaverse'
        ],
        products: ['Facebook', 'Instagram', 'WhatsApp', 'Messenger', 'Reality Labs']
      },
      'facebook': {
        values: 'move fast, be bold, focus on impact',
        culture: 'feedback culture, hackathons, bottom-up innovation',
        talkingPoints: [
          'Meta\'s mission to bring people together',
          'innovations in social technology',
          'work on Facebook, Instagram, or WhatsApp',
          'connecting billions of users worldwide'
        ],
        products: ['Facebook', 'Instagram', 'WhatsApp', 'Messenger']
      },
      'microsoft': {
        values: 'growth mindset, customer obsession, diversity',
        culture: 'inclusive, innovation, cloud-first',
        talkingPoints: [
          'Microsoft\'s mission to empower every person and organization',
          'innovations in AI and cloud computing',
          'work on Azure, Office 365, or Windows',
          'transformation under Satya Nadella'
        ],
        products: ['Azure', 'Office 365', 'Windows', 'Teams', 'GitHub', 'LinkedIn']
      },
      'amazon': {
        values: 'customer obsession, ownership, invent and simplify',
        culture: 'fast-paced, high-bar, leadership principles',
        talkingPoints: [
          'Amazon\'s customer-first approach',
          'innovations in e-commerce and cloud infrastructure',
          'work on AWS, Alexa, or Prime',
          'building Earth\'s most customer-centric company'
        ],
        products: ['AWS', 'Prime', 'Alexa', 'Kindle', 'Amazon.com']
      },
      'apple': {
        values: 'innovation, simplicity, privacy',
        culture: 'design-driven, attention to detail, secrecy',
        talkingPoints: [
          'Apple\'s commitment to user privacy',
          'innovations in hardware and software integration',
          'work on iPhone, Mac, or Services',
          'creating products people love'
        ],
        products: ['iPhone', 'Mac', 'iPad', 'Apple Watch', 'Services']
      },
      'netflix': {
        values: 'freedom and responsibility, context not control',
        culture: 'high performance, radical candor',
        talkingPoints: [
          'Netflix\'s streaming innovation',
          'data-driven content recommendations',
          'work on personalization or content delivery',
          'revolutionizing entertainment'
        ],
        products: ['Streaming Platform', 'Content Production', 'Recommendations']
      },
      'uber': {
        values: 'bold, customer obsessed, we do the right thing',
        culture: 'fast-paced, global impact',
        talkingPoints: [
          'Uber\'s mission to ignite opportunity',
          'innovations in mobility and delivery',
          'work on ride-sharing or Uber Eats',
          'connecting riders and drivers globally'
        ],
        products: ['Ride-sharing', 'Uber Eats', 'Freight', 'Transit']
      },
      'airbnb': {
        values: 'champion the mission, be a host, embrace the adventure',
        culture: 'design-led, community-focused',
        talkingPoints: [
          'Airbnb\'s mission to create a world where anyone can belong',
          'innovations in travel and hospitality',
          'work on trust and safety or host tools',
          'building a global community'
        ],
        products: ['Stays', 'Experiences', 'Host Platform']
      },
      'stripe': {
        values: 'move with urgency, think rigorously, users first',
        culture: 'developer-centric, high-quality engineering',
        talkingPoints: [
          'Stripe\'s mission to increase GDP of the internet',
          'innovations in payment infrastructure',
          'work on developer tools or financial products',
          'powering online commerce'
        ],
        products: ['Payments', 'Billing', 'Connect', 'Atlas']
      },
      'salesforce': {
        values: 'trust, customer success, innovation, equality',
        culture: 'ohana (family), giving back, cloud-first',
        talkingPoints: [
          'Salesforce\'s customer 360 platform',
          'innovations in CRM and enterprise software',
          'work on Service Cloud or Einstein AI',
          'commitment to equality and philanthropy'
        ],
        products: ['Sales Cloud', 'Service Cloud', 'Marketing Cloud', 'Einstein AI']
      },
      'linkedin': {
        values: 'members first, relationships matter, be open honest and constructive',
        culture: 'transformation, professional development',
        talkingPoints: [
          'LinkedIn\'s mission to connect professionals',
          'innovations in professional networking',
          'work on job search or learning platform',
          'creating economic opportunities'
        ],
        products: ['Professional Network', 'Jobs', 'Learning', 'Sales Navigator']
      },
      'spotify': {
        values: 'innovative, collaborative, sincere, passionate',
        culture: 'agile squads, music-first',
        talkingPoints: [
          'Spotify\'s mission to unlock the potential of human creativity',
          'innovations in music streaming and discovery',
          'work on personalization or creator tools',
          'connecting artists and fans'
        ],
        products: ['Music Streaming', 'Podcasts', 'Discover Weekly', 'Wrapped']
      },
      'nvidia': {
        values: 'speed, agility, excellence',
        culture: 'innovation-driven, GPU expertise',
        talkingPoints: [
          'NVIDIA\'s leadership in AI and GPU computing',
          'innovations in graphics and machine learning',
          'work on CUDA or autonomous vehicles',
          'powering the AI revolution'
        ],
        products: ['GPUs', 'CUDA', 'Omniverse', 'Drive']
      }
    };
  }

  /**
   * Get company context by name
   * @param {string} companyName - Company name
   * @returns {Object|null} - Company context or null
   */
  getContext(companyName = '') {
    const normalized = companyName.toLowerCase().trim();

    // Direct match
    if (this.companyData[normalized]) {
      return {
        ...this.companyData[normalized],
        name: companyName
      };
    }

    // Partial match
    for (const [key, value] of Object.entries(this.companyData)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return {
          ...value,
          name: companyName
        };
      }
    }

    return null;
  }

  /**
   * Get random talking point for company
   * @param {string} companyName - Company name
   * @returns {string} - Talking point or generic fallback
   */
  getTalkingPoint(companyName = '') {
    const context = this.getContext(companyName);

    if (context && context.talkingPoints && context.talkingPoints.length > 0) {
      const randomIndex = Math.floor(Math.random() * context.talkingPoints.length);
      return context.talkingPoints[randomIndex];
    }

    return `the innovative work at ${companyName}`;
  }

  /**
   * Check if company has context data
   * @param {string} companyName - Company name
   * @returns {boolean}
   */
  hasContext(companyName = '') {
    return this.getContext(companyName) !== null;
  }

  /**
   * Get all supported companies
   * @returns {Array<string>} - List of company names
   */
  getSupportedCompanies() {
    return Object.keys(this.companyData).map(key => {
      // Capitalize first letter
      return key.charAt(0).toUpperCase() + key.slice(1);
    });
  }
}

// Export singleton instance
const companyContext = new CompanyContext();
