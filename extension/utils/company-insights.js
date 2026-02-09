// Company Insights Database
// Provides context-specific information about major companies

class CompanyInsights {
  constructor() {
    this.insights = {
      // Big Tech
      'google': {
        recentNews: ['Launched Gemini 2.0', 'Expanding AI team', 'New Google Cloud AI features'],
        challenges: ['AI competition with OpenAI', 'Regulatory scrutiny in EU', 'Layoffs in 2023-2024'],
        culture: ['Innovation-focused', '20% time for side projects', 'Data-driven decisions', 'Collaborative'],
        interviewTips: ['Coding rounds (LeetCode medium/hard)', 'System design', 'Behavioral (Googleyness)', 'Bar raiser'],
        keywords: ['Innovation', 'Scale', 'Impact', 'User-first', 'Moonshots'],
        focus: ['AI/ML', 'Cloud computing', 'Search & ads', 'Android', 'YouTube']
      },

      'meta': {
        recentNews: ['Meta AI integration across apps', 'Quest 3 VR headset launch', 'Threads growth'],
        challenges: ['Metaverse pivot skepticism', 'Privacy concerns', 'TikTok competition'],
        culture: ['Move fast', 'Be bold', 'Focus on impact', 'Build social value'],
        interviewTips: ['Coding + product sense', 'System design', 'Jedi rounds', 'Culture fit'],
        keywords: ['Connection', 'Community', 'Innovation', 'Scale', 'Impact'],
        focus: ['Social media', 'VR/AR', 'AI', 'Messaging', 'Advertising']
      },

      'microsoft': {
        recentNews: ['OpenAI partnership expansion', 'Azure AI growth', 'Activision acquisition'],
        challenges: ['Cloud competition with AWS', 'Gaming integration', 'GitHub Copilot adoption'],
        culture: ['Growth mindset', 'Customer obsessed', 'Diversity & inclusion', 'One Microsoft'],
        interviewTips: ['Coding rounds', 'System design', 'Behavioral (growth mindset)', 'As-appropriate round'],
        keywords: ['Innovation', 'Trust', 'Inclusive', 'Empower', 'Growth'],
        focus: ['Cloud (Azure)', 'AI', 'Office 365', 'Gaming', 'LinkedIn']
      },

      'amazon': {
        recentNews: ['AWS continues to dominate cloud', 'Prime Video expansion', 'Amazon Pharmacy growth'],
        challenges: ['Union organizing efforts', 'Antitrust scrutiny', 'Retail competition'],
        culture: ['Customer obsession', 'Ownership', 'Bias for action', 'Frugality', 'Think big'],
        interviewTips: ['Coding + algorithms', 'System design', 'Leadership principles', 'Bar raiser round'],
        keywords: ['Customer obsession', 'Innovation', 'Scale', 'Ownership', 'Delivery'],
        focus: ['E-commerce', 'AWS', 'Logistics', 'Devices (Alexa)', 'Entertainment']
      },

      'apple': {
        recentNews: ['Vision Pro launch', 'Apple Silicon expansion', 'Services growth'],
        challenges: ['EU regulatory pressure', 'China market challenges', 'App Store antitrust'],
        culture: ['Design excellence', 'Privacy-first', 'Secrecy', 'Innovation', 'Attention to detail'],
        interviewTips: ['Coding + algorithms', 'System design', 'Product passion', 'Design thinking'],
        keywords: ['Innovation', 'Privacy', 'Quality', 'User experience', 'Design'],
        focus: ['iPhone/iPad', 'Services', 'Wearables', 'Vision Pro', 'Apple Silicon']
      },

      'netflix': {
        recentNews: ['Password sharing crackdown success', 'Live sports deals', 'Gaming expansion'],
        challenges: ['Competition from Disney+/HBO', 'Content costs', 'International growth'],
        culture: ['Freedom & responsibility', 'Context not control', 'High performance', 'Radical candor'],
        interviewTips: ['Coding excellence', 'Culture fit (keeper test)', 'Values alignment', 'Impact focus'],
        keywords: ['Entertainment', 'Innovation', 'Freedom', 'Impact', 'Excellence'],
        focus: ['Streaming', 'Original content', 'Gaming', 'Global expansion', 'Advertising tier']
      },

      'tesla': {
        recentNews: ['Cybertruck production ramp', 'Full Self-Driving progress', 'Gigafactory expansion'],
        challenges: ['Competition from legacy auto', 'FSD regulatory approval', 'Production scaling'],
        culture: ['First principles thinking', 'Rapid iteration', 'Extremely hardcore', 'Mission-driven'],
        interviewTips: ['Technical depth', 'Problem-solving under constraints', 'Passion for mission', 'Long hours'],
        keywords: ['Innovation', 'Sustainability', 'First principles', 'Speed', 'Impact'],
        focus: ['Electric vehicles', 'Autonomous driving', 'Energy storage', 'Solar', 'AI']
      },

      'stripe': {
        recentNews: ['Revenue growth', 'Stablecoin payment support', 'Global expansion'],
        challenges: ['Fintech competition', 'Regulatory complexity', 'Economic slowdown impact'],
        culture: ['User-first', 'High velocity', 'Global mindset', 'Long-term thinking'],
        interviewTips: ['Coding + system design', 'Product thinking', 'Debugging skills', 'Communication'],
        keywords: ['Developer-first', 'Reliability', 'Global', 'Innovation', 'Trust'],
        focus: ['Payment processing', 'Billing', 'Financial infrastructure', 'Crypto', 'Global expansion']
      },

      'airbnb': {
        recentNews: ['Record bookings post-pandemic', 'New categories launch', 'Long-term stays growth'],
        challenges: ['Regulatory battles in cities', 'Hotel competition', 'Quality control'],
        culture: ['Belong anywhere', 'Be a host', 'Champion the mission', 'Simplify'],
        interviewTips: ['Coding rounds', 'Product sense', 'Design thinking', 'Cross-functional collaboration'],
        keywords: ['Belonging', 'Community', 'Experience', 'Trust', 'Innovation'],
        focus: ['Short-term rentals', 'Experiences', 'Long-term stays', 'Luxury (Luxe)', 'International']
      },

      'uber': {
        recentNews: ['Profitability achieved', 'Uber Eats growth', 'Autonomous vehicle partnerships'],
        challenges: ['Driver classification battles', 'Competition from Lyft', 'Regulatory complexity'],
        culture: ['Move fast', 'Be bold', 'Customer obsessed', 'Celebrate cities'],
        interviewTips: ['Coding + algorithms', 'System design', 'Product thinking', 'Behavioral'],
        keywords: ['Opportunity', 'Movement', 'Innovation', 'Safety', 'Reliability'],
        focus: ['Ridesharing', 'Food delivery', 'Freight', 'Autonomous', 'Global expansion']
      },

      'linkedin': {
        recentNews: ['AI-powered features', 'Premium subscriptions growth', 'LinkedIn Learning expansion'],
        challenges: ['Maintaining authentic networking', 'Content quality', 'Spam/scams'],
        culture: ['Members first', 'Relationships matter', 'Be open honest & constructive', 'Demand excellence'],
        interviewTips: ['Coding rounds', 'System design', 'Product thinking', 'Culture fit'],
        keywords: ['Connection', 'Professional', 'Opportunity', 'Trust', 'Growth'],
        focus: ['Professional networking', 'Recruiting', 'Learning', 'Content', 'Advertising']
      }
    };

    // Add common startup patterns
    this.startupInsights = {
      recentNews: ['Recent funding round', 'Rapid growth', 'Product launches'],
      challenges: ['Scaling challenges', 'Market competition', 'Talent acquisition'],
      culture: ['Fast-paced', 'Ownership', 'Impact-driven', 'Scrappy'],
      interviewTips: ['Versatility', 'Problem-solving', 'Culture fit', 'Passion for mission'],
      keywords: ['Innovation', 'Growth', 'Impact', 'Agility', 'Ownership'],
      focus: ['Product-market fit', 'Customer acquisition', 'Scaling']
    };
  }

  /**
   * Get insights for a company
   * @param {string} companyName
   * @returns {Object} - Company insights
   */
  getInsights(companyName) {
    if (!companyName) return null;

    const normalized = companyName.toLowerCase().trim();

    // Check exact match
    if (this.insights[normalized]) {
      return {
        ...this.insights[normalized],
        isExactMatch: true,
        companyName: companyName
      };
    }

    // Check partial match
    for (const [key, insights] of Object.entries(this.insights)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return {
          ...insights,
          isExactMatch: false,
          companyName: companyName
        };
      }
    }

    // Return startup insights as fallback
    return {
      ...this.startupInsights,
      isExactMatch: false,
      isStartup: true,
      companyName: companyName
    };
  }

  /**
   * Get conversation starters based on company
   * @param {string} companyName
   * @returns {Array} - Suggested conversation starters
   */
  getConversationStarters(companyName) {
    const insights = this.getInsights(companyName);
    if (!insights) return [];

    const starters = [];

    // Add recent news starters
    if (insights.recentNews && insights.recentNews.length > 0) {
      starters.push({
        text: `I saw ${companyName}'s recent ${insights.recentNews[0].toLowerCase()} - really exciting!`,
        type: 'recentNews',
        topic: insights.recentNews[0]
      });
    }

    // Add focus area starters
    if (insights.focus && insights.focus.length > 0) {
      starters.push({
        text: `I'm really interested in ${companyName}'s work in ${insights.focus[0].toLowerCase()}`,
        type: 'focus',
        topic: insights.focus[0]
      });
    }

    // Add culture starters
    if (insights.culture && insights.culture.length > 0) {
      starters.push({
        text: `I really admire ${companyName}'s ${insights.culture[0].toLowerCase()} culture`,
        type: 'culture',
        topic: insights.culture[0]
      });
    }

    return starters;
  }

  /**
   * Enhance draft with company-specific insights
   * @param {string} draft - Original draft
   * @param {string} companyName
   * @returns {Object} - { enhancedDraft, suggestions }
   */
  enhanceWithInsights(draft, companyName) {
    const insights = this.getInsights(companyName);
    if (!insights) return { enhancedDraft: draft, suggestions: [] };

    const suggestions = [];

    // Suggest mentioning recent news
    if (insights.recentNews && insights.recentNews.length > 0) {
      suggestions.push({
        type: 'recentNews',
        text: `💡 Mention: "${insights.recentNews[0]}" to show you're up-to-date`,
        topic: insights.recentNews[0]
      });
    }

    // Suggest using company keywords
    if (insights.keywords && insights.keywords.length > 0) {
      const missingKeywords = insights.keywords.filter(k =>
        !draft.toLowerCase().includes(k.toLowerCase())
      );

      if (missingKeywords.length > 0) {
        suggestions.push({
          type: 'keywords',
          text: `💡 Consider using keywords: ${missingKeywords.slice(0, 3).join(', ')}`,
          keywords: missingKeywords
        });
      }
    }

    // Suggest focus areas
    if (insights.focus && insights.focus.length > 0) {
      suggestions.push({
        type: 'focus',
        text: `💡 Focus areas to mention: ${insights.focus.slice(0, 2).join(', ')}`,
        topics: insights.focus
      });
    }

    return {
      enhancedDraft: draft,
      suggestions: suggestions,
      insights: insights
    };
  }

  /**
   * Get interview tips for company
   * @param {string} companyName
   * @returns {Array} - Interview tips
   */
  getInterviewTips(companyName) {
    const insights = this.getInsights(companyName);
    if (!insights || !insights.interviewTips) return [];

    return insights.interviewTips.map(tip => ({
      text: tip,
      category: this._categorizeTip(tip)
    }));
  }

  /**
   * Categorize interview tip
   */
  _categorizeTip(tip) {
    const lower = tip.toLowerCase();

    if (lower.includes('coding') || lower.includes('algorithm')) return 'technical';
    if (lower.includes('system design') || lower.includes('architecture')) return 'design';
    if (lower.includes('behavioral') || lower.includes('culture')) return 'behavioral';
    if (lower.includes('product')) return 'product';

    return 'general';
  }

  /**
   * Check if company is in database
   * @param {string} companyName
   * @returns {boolean}
   */
  hasInsights(companyName) {
    if (!companyName) return false;

    const normalized = companyName.toLowerCase().trim();
    return this.insights.hasOwnProperty(normalized);
  }

  /**
   * Get all companies with insights
   * @returns {Array}
   */
  getAllCompanies() {
    return Object.keys(this.insights);
  }
}

// Export singleton instance
const companyInsights = new CompanyInsights();
