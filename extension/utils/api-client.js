// API Client for Ellyn Web App
// Handles all communication with the Next.js backend

class APIClient {
  constructor() {
    // Default to localhost for development
    // Change to production URL when deploying
    this.baseURL = 'http://localhost:3000';
  }

  /**
   * Enrich contact data (discover emails)
   * @param {Object} contactData - { firstName, lastName, company, role }
   * @returns {Promise<Object>} - { success, enrichment, emails, cost }
   */
  async enrichContact(contactData) {
    try {
      const response = await fetch(`${this.baseURL}/api/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[APIClient] Enrich error:', error);
      throw error;
    }
  }

  /**
   * Save contact to database
   * @param {Object} contactData - Full contact data including email
   * @returns {Promise<Object>} - { success, contact }
   */
  async saveContact(contactData) {
    try {
      const response = await fetch(`${this.baseURL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[APIClient] Save contact error:', error);
      throw error;
    }
  }

  /**
   * Get recent contacts
   * @param {number} limit - Number of contacts to fetch
   * @returns {Promise<Array>} - Array of contacts
   */
  async getRecentContacts(limit = 5) {
    try {
      const response = await fetch(`${this.baseURL}/api/contacts?limit=${limit}&page=1`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.contacts || [];
    } catch (error) {
      console.error('[APIClient] Get contacts error:', error);
      throw error;
    }
  }

  /**
   * Record learning feedback
   * @param {Object} feedback - { contactId, wasCorrect, actualEmail }
   * @returns {Promise<Object>}
   */
  async recordFeedback(feedback) {
    try {
      const response = await fetch(`${this.baseURL}/api/learning/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[APIClient] Record feedback error:', error);
      throw error;
    }
  }

  /**
   * Check API health
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('[APIClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Update base URL (for switching between dev/prod)
   * @param {string} url
   */
  setBaseURL(url) {
    this.baseURL = url;
  }
}

// Export singleton instance
const apiClient = new APIClient();
