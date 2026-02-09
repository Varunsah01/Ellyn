// Chrome Storage helper for extension

class StorageHelper {
  constructor() {
    this.storage = chrome.storage.sync;
  }

  // Save auth token
  async saveAuthToken(token) {
    await this.storage.set({ authToken: token });
  }

  // Get auth token
  async getAuthToken() {
    const result = await this.storage.get(['authToken']);
    return result.authToken || null;
  }

  // Save recent contacts (last 5)
  async saveRecentContact(contact) {
    const { recentContacts = [] } = await this.storage.get(['recentContacts']);

    // Add to beginning, remove duplicates, keep max 5
    const updated = [
      contact,
      ...recentContacts.filter(c => c.id !== contact.id)
    ].slice(0, 5);

    await this.storage.set({ recentContacts: updated });
  }

  // Get recent contacts
  async getRecentContacts() {
    const { recentContacts = [] } = await this.storage.get(['recentContacts']);
    return recentContacts;
  }

  // Save user profile
  async saveUserProfile(profile) {
    await this.storage.set({ userProfile: profile });
  }

  // Get user profile
  async getUserProfile() {
    const { userProfile = null } = await this.storage.get(['userProfile']);
    return userProfile;
  }

  // Clear all data
  async clear() {
    await this.storage.clear();
  }
}

const storage = new StorageHelper();
