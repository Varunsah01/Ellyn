/* eslint-disable no-console */
const QUOTA_DEFAULTS = {
  apiBaseUrl: 'https://www.useellyn.com',
  statusCacheTtlMs: 60 * 1000,
  upgradeUrl: 'https://www.useellyn.com/pricing',
};

class QuotaManager {
  constructor(config = {}) {
    this.config = {
      ...QUOTA_DEFAULTS,
      ...config,
    };
    this.statusCache = null;
    this.statusCacheAt = 0;
  }

  async canPerformLookup() {
    try {
      const response = await this.request('/api/quota/check', { method: 'POST' });

      if (response.status === 429) {
        const resetDate = response.payload?.resetDate || null;
        const remaining = Number(response.payload?.remaining || 0);
        return {
          allowed: false,
          remaining,
          resetDate,
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          return {
            allowed: false,
            remaining: 0,
            resetDate: null,
            error: 'Unauthorized',
          };
        }

        this.log('Quota check failed, allowing request as fallback', {
          status: response.status,
          payload: response.payload,
        });
        return {
          allowed: true,
          remaining: null,
          resetDate: null,
          warning: 'Quota check unavailable',
        };
      }

      return {
        allowed: Boolean(response.payload?.allowed),
        remaining: this.toMaybeNumber(response.payload?.remaining),
        resetDate: response.payload?.resetDate || null,
      };
    } catch (error) {
      this.log('canPerformLookup error, allowing as fallback', this.serializeError(error));
      return {
        allowed: true,
        remaining: null,
        resetDate: null,
        warning: 'Quota service unreachable',
      };
    }
  }

  async getStatus() {
    const now = Date.now();
    if (this.statusCache && now - this.statusCacheAt < this.config.statusCacheTtlMs) {
      return { ...this.statusCache, source: 'cache' };
    }

    try {
      const response = await this.request('/api/quota/status', { method: 'GET' });
      if (!response.ok) {
        if (response.status === 401) {
          return {
            allowed: false,
            used: null,
            limit: null,
            remaining: null,
            resetDate: null,
            planType: null,
            error: 'Unauthorized',
          };
        }

        if (this.statusCache) {
          return { ...this.statusCache, source: 'stale-cache' };
        }

        return {
          allowed: true,
          used: null,
          limit: null,
          remaining: null,
          resetDate: null,
          planType: null,
          error: 'Quota status unavailable',
        };
      }

      const status = {
        allowed:
          Number.isFinite(Number(response.payload?.remaining)) &&
          Number(response.payload?.remaining) > 0,
        used: this.toMaybeNumber(response.payload?.used),
        limit: this.toMaybeNumber(response.payload?.limit),
        remaining: this.toMaybeNumber(response.payload?.remaining),
        resetDate: response.payload?.resetDate || null,
        planType: response.payload?.planType || null,
      };

      this.statusCache = status;
      this.statusCacheAt = now;
      return { ...status, source: 'network' };
    } catch (error) {
      this.log('getStatus error', this.serializeError(error));
      if (this.statusCache) {
        return { ...this.statusCache, source: 'stale-cache' };
      }

      return {
        allowed: true,
        used: null,
        limit: null,
        remaining: null,
        resetDate: null,
        planType: null,
        error: 'Quota status unavailable',
      };
    }
  }

  showUpgradeModal(resetDate) {
    const payload = {
      type: 'SHOW_UPGRADE_MODAL',
      data: {
        resetDate: resetDate || null,
        upgradeUrl: this.config.upgradeUrl,
      },
    };

    this.log('Broadcasting quota-upgrade signal', payload.data);

    try {
      chrome.runtime.sendMessage(payload, () => {
        // Ignore missing listeners in some contexts.
        void chrome.runtime.lastError;
      });
    } catch (error) {
      this.log('Failed to broadcast SHOW_UPGRADE_MODAL', this.serializeError(error));
    }

    return payload.data;
  }

  async request(path, options = {}) {
    const token = await this.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const headers = {
      Accept: 'application/json',
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    let response;
    try {
      response = await fetch(`${this.config.apiBaseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  }

  async getAuthToken() {
    try {
      const result = await chrome.storage.local.get(['auth_token']);
      const token = result?.auth_token;
      return typeof token === 'string' && token.length > 0 ? token : '';
    } catch (error) {
      this.log('Failed reading auth token', this.serializeError(error));
      return '';
    }
  }

  toMaybeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  serializeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }
    return { message: String(error) };
  }

  log(message, data) {
    if (typeof data === 'undefined') {
      console.log(`[QuotaManager] ${message}`);
      return;
    }
    console.log(`[QuotaManager] ${message}`, data);
  }
}

const quotaManager = new QuotaManager();

if (typeof globalThis !== 'undefined') {
  globalThis.QuotaManager = QuotaManager;
  globalThis.quotaManager = quotaManager;
}
