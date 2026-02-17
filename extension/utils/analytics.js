/* eslint-disable no-console */
const ANALYTICS_DEFAULTS = {
  apiBaseUrl: 'https://www.useellyn.com',
  statsCacheTtlMs: 60 * 1000,
  timeoutMs: 8000,
};

class Analytics {
  constructor(config = {}) {
    this.config = {
      ...ANALYTICS_DEFAULTS,
      ...config,
    };
    this.statsCache = new Map();
  }

  async getUserStats(period = 'month') {
    const normalizedPeriod = this.normalizePeriod(period);
    const cacheKey = `user:${normalizedPeriod}`;
    const now = Date.now();
    const cached = this.statsCache.get(cacheKey);

    if (cached && now - cached.cachedAt < this.config.statsCacheTtlMs) {
      return { ...cached.value, source: 'cache' };
    }

    try {
      const response = await this.request(`/api/v1/analytics/user?period=${encodeURIComponent(normalizedPeriod)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        return this.buildFallbackStats(normalizedPeriod, response.status, response.payload);
      }

      const payload = response.payload?.data || response.payload || {};
      const stats = {
        period: normalizedPeriod,
        totalLookups: this.toNumber(payload.totalLookups, 0),
        successfulLookups: this.toNumber(payload.successfulLookups, 0),
        successRate: this.toNumber(payload.successRate, 0),
        cacheHitRate: this.toNumber(payload.cacheHitRate, 0),
        avgConfidence: this.toNumber(payload.avgConfidence, 0),
        totalCostUsd: this.toNumber(payload.totalCostUsd, 0),
        avgCostPerLookup: this.toNumber(payload.avgCostPerLookup, 0),
        mostCommonPattern: payload.mostCommonPattern || null,
        generatedAt: response.payload?.generatedAt || new Date().toISOString(),
      };

      this.statsCache.set(cacheKey, {
        cachedAt: now,
        value: stats,
      });

      return { ...stats, source: 'network' };
    } catch (error) {
      this.log('getUserStats failed', this.serializeError(error));
      return this.buildFallbackStats(normalizedPeriod, 0, null);
    }
  }

  renderStatsCard(stats) {
    const safeStats = stats || this.buildFallbackStats('month', 0, null);
    const totalLookups = this.toNumber(safeStats.totalLookups, 0);
    const successRate = this.toNumber(safeStats.successRate, 0).toFixed(2);
    const cacheHitRate = this.toNumber(safeStats.cacheHitRate, 0).toFixed(2);
    const avgConfidence = this.toNumber(safeStats.avgConfidence, 0).toFixed(2);
    const totalCostUsd = this.toNumber(safeStats.totalCostUsd, 0).toFixed(6);

    return `
      <section class="ellyn-stats-card" aria-label="Email Finder Analytics">
        <header class="ellyn-stats-header">
          <h3 class="ellyn-stats-title">Usage Analytics</h3>
          <span class="ellyn-stats-period">${this.escapeHtml(safeStats.period || 'month')}</span>
        </header>
        <div class="ellyn-stats-grid">
          <div class="ellyn-stat"><span>Total lookups</span><strong>${totalLookups}</strong></div>
          <div class="ellyn-stat"><span>Success rate</span><strong>${successRate}%</strong></div>
          <div class="ellyn-stat"><span>Cache hit rate</span><strong>${cacheHitRate}%</strong></div>
          <div class="ellyn-stat"><span>Avg confidence</span><strong>${avgConfidence}</strong></div>
          <div class="ellyn-stat"><span>Total cost</span><strong>$${totalCostUsd}</strong></div>
        </div>
      </section>
    `.trim();
  }

  async trackLookup(data) {
    try {
      const payload = this.normalizeLookupPayload(data);
      const response = await this.request('/api/v1/analytics/track-lookup', {
        method: 'POST',
        body: payload,
      });

      if (!response.ok) {
        this.log('trackLookup failed', {
          status: response.status,
          payload: response.payload,
        });
        return {
          success: false,
          status: response.status,
          error: response.payload?.error || 'Failed to track lookup',
        };
      }

      this.statsCache.clear();
      return {
        success: true,
        data: response.payload?.data || null,
      };
    } catch (error) {
      this.log('trackLookup exception', this.serializeError(error));
      return {
        success: false,
        status: 0,
        error: 'Lookup tracking unavailable',
      };
    }
  }

  async exportUserCsv(period = 'month') {
    const normalizedPeriod = this.normalizePeriod(period);
    const token = await this.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/v1/analytics/user?period=${encodeURIComponent(normalizedPeriod)}&format=csv`,
        {
          method: 'GET',
          headers: {
            Accept: 'text/csv',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `CSV export failed with status ${response.status}`,
        };
      }

      const csv = await response.text();
      return {
        success: true,
        csv,
      };
    } catch (error) {
      this.log('exportUserCsv exception', this.serializeError(error));
      return {
        success: false,
        error: 'CSV export unavailable',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request(path, options = {}) {
    const token = await this.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

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
      return typeof result?.auth_token === 'string' ? result.auth_token : '';
    } catch (error) {
      this.log('getAuthToken failed', this.serializeError(error));
      return '';
    }
  }

  normalizeLookupPayload(data) {
    const confidence = this.clamp(this.toNumber(data?.confidence, 0), 0, 1);
    const cost = Math.max(0, this.toNumber(data?.cost, 0));
    const duration = Math.max(0, Math.round(this.toNumber(data?.duration, 0)));

    return {
      profileUrl: String(data?.profileUrl || '').trim() || null,
      domain: this.normalizeDomain(data?.domain),
      email: String(data?.email || '').trim().toLowerCase(),
      pattern: String(data?.pattern || '').trim().toLowerCase(),
      confidence,
      source: String(data?.source || 'other').trim().toLowerCase(),
      cacheHit: data?.cacheHit === true,
      cost,
      duration,
      success: data?.success !== false,
    };
  }

  normalizeDomain(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0];
  }

  normalizePeriod(period) {
    const value = String(period || 'month').toLowerCase();
    if (value === 'day' || value === 'week' || value === 'month' || value === 'all') {
      return value;
    }
    return 'month';
  }

  buildFallbackStats(period, status, payload) {
    if (status && status !== 401) {
      this.log('Analytics fallback', { status, payload });
    }

    return {
      period,
      totalLookups: 0,
      successfulLookups: 0,
      successRate: 0,
      cacheHitRate: 0,
      avgConfidence: 0,
      totalCostUsd: 0,
      avgCostPerLookup: 0,
      mostCommonPattern: null,
      generatedAt: new Date().toISOString(),
      source: status === 401 ? 'unauthorized' : 'fallback',
    };
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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
      console.log(`[Analytics] ${message}`);
      return;
    }
    console.log(`[Analytics] ${message}`, data);
  }
}

const analytics = new Analytics();

if (typeof globalThis !== 'undefined') {
  globalThis.Analytics = Analytics;
  globalThis.analytics = analytics;
}

